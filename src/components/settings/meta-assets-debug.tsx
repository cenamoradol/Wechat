"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";

type DebugData = {
  app: { id: string | null; name: string | null };
  token_used: "whatsapp_channel" | "none";
  bms: Array<{ id: string; name: string }>;
  pages: Array<{ id: string; name: string; tasks: string[] }>;
  whatsapp_accounts: Array<{ id: string; name: string; phone_numbers: string[] }>;
  instagram_business_accounts: Array<{
    id: string;
    page_id: string;
    username: string | null;
  }>;
  scopes: string[];
  app_id_matches: boolean;
  warnings: string[];
};

const REQUIRED_SCOPES = [
  "business_management",
  "pages_show_list",
  "pages_messaging",
  "instagram_basic",
  "instagram_manage_messages",
  "whatsapp_business_management",
  "whatsapp_business_messaging",
];

export function MetaAssetsDebug() {
  const [data, setData] = useState<DebugData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/debug/meta-assets");
      if (!r.ok) {
        setError(`Error ${r.status}`);
        return;
      }
      setData(await r.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Consultando Meta Graph API...
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Token usado: <code>{data.token_used}</code>
          {data.app.id && <> · App: <code>{data.app.id}</code></>}
        </p>
        <Button size="sm" variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`mr-2 h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refrescar
        </Button>
      </div>

      {/* Warnings */}
      {data.warnings.length > 0 && (
        <div className="space-y-1 rounded-md border bg-muted/30 p-3 text-xs">
          {data.warnings.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </div>
      )}

      {/* Scopes */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide">Scopes del token</h4>
        {data.scopes.length === 0 ? (
          <p className="text-xs text-muted-foreground">No se detectaron scopes.</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {data.scopes.map((s) => (
              <span
                key={s}
                className={`rounded px-2 py-0.5 text-xs ${
                  REQUIRED_SCOPES.includes(s)
                    ? "bg-emerald-100 text-emerald-900"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {REQUIRED_SCOPES.includes(s) ? "✅" : "○"} {s}
              </span>
            ))}
          </div>
        )}
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            Scopes requeridos no presentes
          </summary>
          <ul className="mt-1 space-y-0.5 text-muted-foreground">
            {REQUIRED_SCOPES.filter((s) => !data.scopes.includes(s)).map((s) => (
              <li key={s}>❌ {s}</li>
            ))}
            {REQUIRED_SCOPES.every((s) => data.scopes.includes(s)) && (
              <li>✅ Todos los scopes requeridos están presentes</li>
            )}
          </ul>
        </details>
      </div>

      {/* Pages */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide">
          Páginas de Facebook ({data.pages.length})
        </h4>
        {data.pages.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Ninguna. Tu System User no admin ninguna página.
          </p>
        ) : (
          <ul className="space-y-1 text-xs">
            {data.pages.map((p) => (
              <li key={p.id} className="rounded border bg-background p-2">
                <div className="font-mono">{p.name}</div>
                <div className="text-muted-foreground">ID: {p.id}</div>
                {p.tasks.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {p.tasks.slice(0, 5).map((t) => (
                      <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* WABAs */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide">
          WhatsApp Business Accounts ({data.whatsapp_accounts.length})
        </h4>
        {data.whatsapp_accounts.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Ninguno. Tu System User no tiene acceso a ningún WABA en este BM.
          </p>
        ) : (
          <ul className="space-y-1 text-xs">
            {data.whatsapp_accounts.map((w) => (
              <li key={w.id} className="rounded border bg-background p-2">
                <div className="font-mono">{w.name}</div>
                <div className="text-muted-foreground">WABA ID: {w.id}</div>
                {w.phone_numbers.length > 0 && (
                  <div className="text-muted-foreground">
                    Números: {w.phone_numbers.join(", ")}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* IG */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide">
          Instagram Business ({data.instagram_business_accounts.length})
        </h4>
        {data.instagram_business_accounts.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Ninguno. Vincula una cuenta IG Business/Creator a una de tus páginas.
          </p>
        ) : (
          <ul className="space-y-1 text-xs">
            {data.instagram_business_accounts.map((ig) => (
              <li key={ig.id} className="rounded border bg-background p-2">
                <div className="font-mono">@{ig.username ?? "(sin username)"}</div>
                <div className="text-muted-foreground">IG ID: {ig.id}</div>
                <div className="text-muted-foreground">Page ID: {ig.page_id}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Checklist */}
      <details className="text-xs">
        <summary className="cursor-pointer font-medium">📋 Checklist si algo falta</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>
            Verifica en <strong>business.facebook.com/settings/users</strong> que tu System User
            tenga <strong>Full Control</strong> en:
            <ul className="mt-1 list-disc pl-5">
              <li>La app (2114975212479283)</li>
              <li>Cada página que quieras conectar</li>
              <li>Cada cuenta de Instagram Business</li>
              <li>Cada WABA</li>
            </ul>
          </li>
          <li>
            Si tu WABA real NO aparece aquí, probablemente está en otro Business Manager. Ve a{" "}
            <strong>business.facebook.com/settings/accounts</strong> y agrégalo a este BM.
          </li>
          <li>
            Regenera el token del System User con TODOS los scopes requeridos:
            <ul className="mt-1 list-disc pl-5">
              {REQUIRED_SCOPES.map((s) => (
                <li key={s}><code>{s}</code></li>
              ))}
            </ul>
          </li>
          <li>
            Para Instagram: tu cuenta de IG debe ser tipo <strong>Business</strong> o{" "}
            <strong>Creator</strong>, y estar enlazada a una página de Facebook que tú admines.
          </li>
          <li>
            Después de cualquier cambio, vuelve a pegar el nuevo token en{" "}
            <strong>/settings/channels → WhatsApp manual</strong>.
          </li>
        </ol>
      </details>
    </div>
  );
}