import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

/**
 * Media proxy route. The `media` bucket is private, so we stream files
 * through this route after validating the user has access to the
 * workspace the file belongs to (encoded in the path as the first segment).
 *
 * Path format: <workspaceId>/messages/<conversationId>/<file>
 *
 * Supports HTTP Range requests so <video>/<audio> can seek.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  if (!segments || segments.length < 2) {
    return NextResponse.json({ error: "Bad path" }, { status: 400 });
  }
  const fullPath = segments.join("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // First segment is the workspaceId. Verify membership.
  const workspaceId = segments[0];
  const { data: member, error: memberErr } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (memberErr) {
    return NextResponse.json({ error: "Permission check failed" }, { status: 500 });
  }
  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Download the file with the admin client (bypasses storage RLS).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const admin = createAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.storage
    .from("media")
    .download(fullPath);
  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buf = Buffer.from(await data.arrayBuffer());
  const total = buf.byteLength;
  // ponytail: Storage.download() doesn't expose type, so derive from extension.
  const contentType = data.type && data.type !== "application/octet-stream"
    ? data.type
    : guessContentType(fullPath);
  const rangeHeader = req.headers.get("range");

  // Range request: 206 Partial Content
  if (rangeHeader) {
    const m = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
    if (m) {
      const start = m[1] ? parseInt(m[1], 10) : 0;
      const end = m[2] ? parseInt(m[2], 10) : total - 1;
      if (start >= 0 && end < total && start <= end) {
        const chunk = buf.subarray(start, end + 1);
        return new NextResponse(new Uint8Array(chunk), {
          status: 206,
          headers: {
            "Content-Type": contentType,
            "Content-Length": String(chunk.byteLength),
            "Content-Range": `bytes ${start}-${end}/${total}`,
            "Accept-Ranges": "bytes",
            "Cache-Control": "private, max-age=3600",
          },
        });
      }
    }
  }

  // No range or unparseable: send full file
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(total),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    },
  });
}

function guessContentType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg"].includes(ext)) return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "mp4" || ext === "m4v") return "video/mp4";
  if (ext === "3gp" || ext === "3gpp") return "video/3gpp";
  if (ext === "webm") return "video/webm";
  if (ext === "mov") return "video/quicktime";
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "m4a") return "audio/mp4";
  if (ext === "ogg" || ext === "oga") return "audio/ogg";
  if (ext === "opus") return "audio/opus";
  if (ext === "aac") return "audio/aac";
  if (ext === "amr") return "audio/amr";
  if (ext === "wav") return "audio/wav";
  if (ext === "pdf") return "application/pdf";
  if (ext === "txt") return "text/plain";
  if (ext === "doc") return "application/msword";
  if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === "xls") return "application/vnd.ms-excel";
  if (ext === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === "ppt") return "application/vnd.ms-powerpoint";
  if (ext === "pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  return "application/octet-stream";
}