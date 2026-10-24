// ponytail: the credential-management feature is the most sensitive thing in
// the app — an admin can create accounts and reset other people's passwords
// without any email confirmation. These tests lock the guard rails.

import { describe, expect, it, vi, beforeEach } from "vitest";

const { getUserMock, activeWorkspaceIdMock, roleState, memberRow, existingAuthUser, callerId, adminMock, authAdminMock } =
  vi.hoisted(() => ({
    getUserMock: vi.fn(),
    activeWorkspaceIdMock: vi.fn(),
    roleState: { value: "owner" as string | null },
    memberRow: { value: null as { role: string } | null },
    existingAuthUser: { value: false as boolean },
    callerId: { value: "admin-1" as string },
    adminMock: { from: vi.fn(), insert: vi.fn() },
    authAdminMock: {
      createUser: vi.fn(),
      updateUserById: vi.fn(),
      listUsers: vi.fn(),
    },
  }));

// roles.ts reads the membership row through the SAME admin client, so the
// mock below must answer for workspace_members too.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { getUser: getUserMock } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    ...adminMock,
    auth: { admin: authAdminMock },
  }),
}));
vi.mock("@/app/(workspace)/actions", () => ({
  getActiveWorkspaceIdAction: activeWorkspaceIdMock,
}));

import { createUserAction, updateMemberCredentialsAction } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  roleState.value = "owner";
  memberRow.value = { role: "agent" };
  existingAuthUser.value = false;
  callerId.value = "admin-1";
  getUserMock.mockResolvedValue({ data: { user: { id: "admin-1", email: "boss@x.com" } } });
  activeWorkspaceIdMock.mockResolvedValue("ws-1");

  // Both roles.ts (the CALLER's membership) and team/actions.ts (the TARGET's
  // membership) hit workspace_members — the mock tells them apart by which
  // user_id was filtered on.
  adminMock.from.mockImplementation((table: string) => {
    const eqArgs: Array<[string, unknown]> = [];
    const node: Record<string, unknown> = {};
    node.select = () => node;
    node.eq = (col: string, val: unknown) => {
      eqArgs.push([col, val]);
      return node;
    };
    node.maybeSingle = () => {
      let data: unknown = null;
      if (table === "workspace_members") {
        const userId = eqArgs.find(([c]) => c === "user_id")?.[1];
        // The CALLER's row is the one matching the logged-in user id.
        data =
          userId === callerId.value
            ? roleState.value
              ? { role: roleState.value }
              : null
            : memberRow.value;
      }
      return Promise.resolve({ data, error: null });
    };
    node.insert = vi.fn().mockResolvedValue({ data: null, error: null });
    node.update = vi.fn(() => {
      const u: Record<string, unknown> = {};
      u.eq = () => Promise.resolve({ data: null, error: null });
      return u;
    });
    node.then = (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled);
    return node;
  });
  authAdminMock.createUser.mockResolvedValue({
    data: { user: { id: "new-1", email: "nuevo@x.com" } },
    error: null,
  });
  authAdminMock.updateUserById.mockResolvedValue({ data: { user: {} }, error: null });
  authAdminMock.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
});

const GOOD_PASSWORD = "Temporal1X";

describe("createUserAction", () => {
  it("creates a confirmed user and attaches them to the workspace", async () => {
    const res = await createUserAction({
      email: "nuevo@x.com",
      password: GOOD_PASSWORD,
      role: "agent",
    });
    expect(res.error).toBeUndefined();
    expect(res.userId).toBe("new-1");
    // email_confirm is the whole point: no confirmation email.
    expect(authAdminMock.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "nuevo@x.com", email_confirm: true }),
    );
  });

  it("rejects an agent with no admin rights", async () => {
    roleState.value = "agent";
    const res = await createUserAction({
      email: "nuevo@x.com",
      password: GOOD_PASSWORD,
      role: "agent",
    });
    expect(res.error).toMatch(/rol/i);
    expect(authAdminMock.createUser).not.toHaveBeenCalled();
  });

  it("rejects a viewer", async () => {
    roleState.value = "viewer";
    const res = await createUserAction({
      email: "nuevo@x.com",
      password: GOOD_PASSWORD,
    });
    expect(res.error).toBeTruthy();
    expect(authAdminMock.createUser).not.toHaveBeenCalled();
  });

  it("stops an admin from minting another owner", async () => {
    roleState.value = "admin";
    const res = await createUserAction({
      email: "nuevo@x.com",
      password: GOOD_PASSWORD,
      role: "owner",
    });
    expect(res.error).toMatch(/owner/i);
    expect(authAdminMock.createUser).not.toHaveBeenCalled();
  });

  it("lets an owner create another owner", async () => {
    const res = await createUserAction({
      email: "nuevo@x.com",
      password: GOOD_PASSWORD,
      role: "owner",
    });
    expect(res.error).toBeUndefined();
  });

  it("rejects a weak password before touching auth", async () => {
    const res = await createUserAction({ email: "nuevo@x.com", password: "corta" });
    expect(res.error).toBeTruthy();
    expect(authAdminMock.createUser).not.toHaveBeenCalled();
  });

  it("rejects a malformed email", async () => {
    const res = await createUserAction({ email: "no-es-email", password: GOOD_PASSWORD });
    expect(res.error).toBeTruthy();
    expect(authAdminMock.createUser).not.toHaveBeenCalled();
  });

  it("reports an auth failure instead of pretending it worked", async () => {
    authAdminMock.createUser.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });
    const res = await createUserAction({
      email: "nuevo@x.com",
      password: GOOD_PASSWORD,
    });
    expect(res.error).toMatch(/boom/);
  });

  it("attaches an account that already exists instead of failing", async () => {
    // The person signed up on their own; we only need their id to add the
    // workspace membership. supabase-js can't query auth.users directly, so
    // the lookup goes through auth.admin.listUsers().
    authAdminMock.createUser.mockResolvedValue({
      data: null,
      error: { message: "A user with this email address has already been registered" },
    });
    authAdminMock.listUsers.mockResolvedValue({
      data: { users: [{ id: "existing-1", email: "nuevo@x.com" }] },
      error: null,
    });
    const res = await createUserAction({
      email: "nuevo@x.com",
      password: GOOD_PASSWORD,
    });
    expect(res.error).toBeUndefined();
    expect(res.userId).toBe("existing-1");
    expect(res.created).toBe(false);
  });

  it("errors when the email is taken and the user cannot be found", async () => {
    authAdminMock.createUser.mockResolvedValue({
      data: null,
      error: { message: "A user with this email address has already been registered" },
    });
    authAdminMock.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
    const res = await createUserAction({
      email: "nuevo@x.com",
      password: GOOD_PASSWORD,
    });
    expect(res.error).toMatch(/Ya existe una cuenta/i);
  });
});

describe("updateMemberCredentialsAction", () => {
  it("updates the password of a member", async () => {
    const res = await updateMemberCredentialsAction({
      userId: "11111111-1111-4111-8111-111111111111",
      password: "NuevaClave1",
    });
    expect(res.error).toBeUndefined();
    expect(authAdminMock.updateUserById).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      expect.objectContaining({ password: "NuevaClave1" }),
    );
  });

  it("confirms the new email so no confirmation step is reintroduced", async () => {
    const res = await updateMemberCredentialsAction({
      userId: "11111111-1111-4111-8111-111111111111",
      email: "Nuevo@x.com",
    });
    expect(res.error).toBeUndefined();
    expect(authAdminMock.updateUserById).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      expect.objectContaining({ email: "nuevo@x.com", email_confirm: true }),
    );
  });

  it("refuses to edit your own credentials", async () => {
    const selfId = "22222222-2222-4222-8222-222222222222";
    callerId.value = selfId;
    getUserMock.mockResolvedValue({ data: { user: { id: selfId, email: "yo@x.com" } } });
    const res = await updateMemberCredentialsAction({
      userId: selfId,
      password: "OtraClave1",
    });
    expect(res.error).toMatch(/tus propias credenciales/i);
    expect(authAdminMock.updateUserById).not.toHaveBeenCalled();
  });

  it("refuses to touch a non-member", async () => {
    memberRow.value = null;
    const res = await updateMemberCredentialsAction({
      userId: "11111111-1111-4111-8111-111111111111",
      password: "NuevaClave1",
    });
    expect(res.error).toMatch(/no es miembro/i);
    expect(authAdminMock.updateUserById).not.toHaveBeenCalled();
  });

  it("stops an admin from resetting an owner's password", async () => {
    roleState.value = "admin";
    memberRow.value = { role: "owner" };
    const res = await updateMemberCredentialsAction({
      userId: "11111111-1111-4111-8111-111111111111",
      password: "NuevaClave1",
    });
    expect(res.error).toMatch(/owner/i);
    expect(authAdminMock.updateUserById).not.toHaveBeenCalled();
  });

  it("lets an owner reset another owner's password", async () => {
    memberRow.value = { role: "owner" };
    const res = await updateMemberCredentialsAction({
      userId: "11111111-1111-4111-8111-111111111111",
      password: "NuevaClave1",
    });
    expect(res.error).toBeUndefined();
  });

  it("rejects an agent", async () => {
    roleState.value = "agent";
    const res = await updateMemberCredentialsAction({
      userId: "11111111-1111-4111-8111-111111111111",
      password: "NuevaClave1",
    });
    expect(res.error).toBeTruthy();
    expect(authAdminMock.updateUserById).not.toHaveBeenCalled();
  });

  it("requires at least one field to change", async () => {
    const res = await updateMemberCredentialsAction({
      userId: "11111111-1111-4111-8111-111111111111",
    });
    expect(res.error).toBeTruthy();
  });

  it("rejects a weak new password", async () => {
    const res = await updateMemberCredentialsAction({
      userId: "11111111-1111-4111-8111-111111111111",
      password: "corta",
    });
    expect(res.error).toBeTruthy();
    expect(authAdminMock.updateUserById).not.toHaveBeenCalled();
  });
});
