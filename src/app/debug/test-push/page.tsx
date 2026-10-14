// Debug page: just visit this URL and it sends a test push + shows the result.
// No console, no JSON to paste. Just text on the page.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";

export const dynamic = "force-dynamic";

export default async function TestPushPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const result = await sendPushToUser({
    userId: user.id,
    event: "new_message",
    payload: {
      title: "Test push · Wechat",
      body: "Si ves esta notificación, el envío funciona. Vuelve a /settings/notifications",
      href: "/settings/notifications",
      tag: `test-${Date.now()}`,
    },
  });

  const color =
    result.sent > 0
      ? "green"
      : result.skipped
        ? "amber"
        : result.removed > 0
          ? "amber"
          : "red";

  return (
    <div style={{ padding: 32, fontFamily: "system-ui", maxWidth: 640 }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Resultado del push de prueba</h1>
      <div
        style={{
          padding: 16,
          borderRadius: 8,
          background: "#f5f5f5",
          border: `2px solid ${color}`,
        }}
      >
        <p>
          <strong>Enviados:</strong> {result.sent}
        </p>
        <p>
          <strong>Suscripciones muertas (borradas):</strong> {result.removed}
        </p>
        <p>
          <strong>Skipped (sin config VAPID):</strong>{" "}
          {result.skipped ? "sí" : "no"}
        </p>
      </div>

      <h2 style={{ marginTop: 24, fontSize: 18 }}>Qué significa</h2>
      <ul style={{ lineHeight: 1.8 }}>
        <li>
          <strong>sent &gt; 0:</strong> el server mandó OK. Si no te llegó al navegador,
          revisá permisos del OS o si el SW está registrado (DevTools → Application →
          Service Workers).
        </li>
        <li>
          <strong>sent = 0, removed &gt; 0:</strong> tu suscripción está muerta. Desactivá
          y reactivá push en /settings/notifications.
        </li>
        <li>
          <strong>sent = 0, skipped = true:</strong> faltan las claves VAPID en .env.local.
        </li>
        <li>
          <strong>sent = 0, skipped = false, removed = 0:</strong> hay suscripción pero
          no se envió. Pegame el log del server (npm run dev) cuando visité esta página.
        </li>
      </ul>

      <p style={{ marginTop: 24 }}>
        <a href="/settings/notifications">← Volver a /settings/notifications</a>
      </p>
    </div>
  );
}