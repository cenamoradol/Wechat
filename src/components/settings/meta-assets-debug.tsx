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

type EncryptionStatus = {
  raw_base64_length: number;
  decoded_bytes: number;
  expected_bytes: number;
  matches_expected: boolean;
  fingerprint_sha256_12: string;
  self_test: string;
  channel: {
    found: boolean;
    external_id?: string;
    type?: string;
    decrypt_ok?: boolean;
    decrypt_error?: string;
  };
  recommendation: string;
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
  const [encStatus, setEncStatus] = useState<EncryptionStatus | null>(null);
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

  const fetchEnc = async () => {
    try {
      const r = await fetch("/api/debug/encryption-status");
      if (r.ok) setEncStatus(await r.json());
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchData();
    fetchEnc();
  }, []);

  return (
    <div className="space-y-6">
      <EncryptionStatusPanel status={encStatus} onRefresh={fetchEnc} />

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Token usado: <code>{data?.token_used ?? "?"}</code>
          {data?.app.id && <> · App: <code>{data.app.id}</code></>}
        </p>
        <Button size="sm" variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`mr-2 h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refrescar
        </Button>
      </div>

      {loading && !data && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Consultando Meta Graph API...
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {data && (
        <>
          {data.warnings.length > 0 && (
            <div className="space-y-1 rounded-md border bg-muted/30 p-3 text-xs">
              {data.warnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </div>
          )}

          <ScopesSection scopes={data.scopes} />

          <ListSection
            title={`Páginas de Facebook (${data.pages.length})`}
            emptyMessage="Ninguna. Tu System User no admin ninguna página."
            items={data.pages.map((p) => ({
              id: p.id,
              primary: p.name,
              secondary: `ID: ${p.id}`,
              tags: p.tasks.slice(0, 5),
            }))}
          />

          <ListSection
            title={`WhatsApp Business Accounts (${data.whatsapp_accounts.length})`}
            emptyMessage="Ninguno. Tu System User no tiene acceso a ningún WABA en este BM."
            items={data.whatsapp_accounts.map((w) => ({
              id: w.id,
              primary: w.name,
              secondary: `WABA ID: ${w.id}`,
              tags: w.phone_numbers,
            }))}
          />

          <ListSection
            title={`Instagram Business (${data.instagram_business_accounts.length})`}
            emptyMessage="Ninguno. Vincula una cuenta IG Business/Creator a una de tus páginas."
            items={data.instagram_business_accounts.map((ig) => ({
              id: ig.id,
              primary: `@${ig.username ?? "(sin username)"}`,
              secondary: `IG ID: ${ig.id} · Page ID: ${ig.page_id}`,
            }))}
          />

          <Checklist />
        </>
      )}
    </div>
  );
}

function EncryptionStatusPanel({
  status,
  onRefresh,
}: {
  status: EncryptionStatus | null;
  onRefresh: () => void;
}) {
  if (!status) return null;
  const ok = status.matches_expected && status.channel?.decrypt_ok !== false;
  return (
    <div
      className={`rounded-md border p-3 text-xs ${
        ok ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="font-semibold uppercase tracking-wide">Estado de cifrado</div>
        <Button size="sm" variant="ghost" onClick={onRefresh} className="h-6 px-2 text-xs">
          Refrescar
        </Button>
      </div>
      <div className="mt-2 grid gap-1 sm:grid-cols-2">
        <div>
          ENCRYPTION_KEY:{" "}
          <strong>
            {status.decoded_bytes} bytes
          </strong>{" "}
          (esperado: {status.expected_bytes}) {status.matches_expected ? "✅" : "❌"}
        </div>
        <div>
          Fingerprint: <code className="font-mono">{status.fingerprint_sha256_12}</code>
        </div>
        <div>
          Self-test: <code>{status.self_test}</code>
        </div>
        {status.channel?.found && (
          <div>
            Canal: <code>{status.channel.type}:{status.channel.external_id}</code>{" "}
            {status.channel.decrypt_ok ? (
              "✅ descifra OK"
            ) : (
              <span className="text-red-700">❌ {status.channel.decrypt_error}</span>
            )}
          </div>
        )}
      </div>
      <div className="mt-2 font-medium">{status.recommendation}</div>
    </div>
  );
}

function ScopesSection({ scopes }: { scopes: string[] }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide">Scopes del token</h4>
      {scopes.length === 0 ? (
        <p className="text-xs text-muted-foreground">No se detectaron scopes.</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {scopes.map((s) => (
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
    </div>
  );
}

function ListSection({
  title,
  emptyMessage,
  items,
}: {
  title: string;
  emptyMessage: string;
  items: Array<{ id: string; primary: string; secondary?: string; tags?: string[] }>;
}) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide">{title}</h4>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="space-y-1 text-xs">
          {items.map((it) => (
            <li key={it.id} className="rounded border bg-background p-2">
              <div className="font-mono">{it.primary}</div>
              {it.secondary && <div className="text-muted-foreground">{it.secondary}</div>}
              {it.tags && it.tags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {it.tags.map((t) => (
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
  );
}

function Checklist() {
  return (
    <details className="text-xs">
      <summary className="cursor-pointer font-medium">📋 Checklist si algo falta</summary>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
        <li>
          Verifica en <strong>business.facebook.com/settings/users</strong> que tu System User tenga{" "}
          <strong>Full Control</strong> en la app, páginas, IG y WABA.
        </li>
        <li>
          Si tu WABA real NO aparece, probablemente está en otro Business Manager. Agrégalo en{" "}
          <strong>business.facebook.com/settings/accounts</strong>.
        </li>
        <li>
          Regenera el System User token con los 7 scopes requeridos (ver arriba).
        </li>
        <li>
          Para Instagram: cuenta <strong>Business</strong>/<strong>Creator</strong> enlazada a una
          página que admines.
        </li>
        <li>
          Tras cualquier cambio, vuelve a pegar el token en{" "}
          <strong>/settings/channels → 🔑 Actualizar token</strong>.
        </li>
      </ol>
    </details>
  );
}