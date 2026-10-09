"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Upload, Search, X, MessageCircle, Mail, Phone, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { createContactAction, importContactsAction } from "@/app/(workspace)/contacts/actions";
import { NewContactDialog } from "./new-contact-dialog";

type Contact = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone_e164: string | null;
  tags: string[];
  notes: string | null;
  channels: Array<{ type: string; display_name: string | null; last_seen: string | null }>;
  lastActivity: string;
};

type Channel = { id: string; type: string; display_name: string };

const CHANNEL_LABELS: Record<string, { label: string; color: string }> = {
  whatsapp: { label: "WhatsApp", color: "bg-green-100 text-green-800" },
  facebook: { label: "Messenger", color: "bg-blue-100 text-blue-800" },
  instagram: { label: "Instagram", color: "bg-pink-100 text-pink-800" },
};

export function ContactsView({
  contacts,
  channels,
  allTags,
  currentFilters,
}: {
  contacts: Contact[];
  channels: Channel[];
  allTags: string[];
  currentFilters: { q: string; tag: string; channel: string };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(currentFilters.q);
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const onSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    applyFilters({ q: search.trim() });
  };

  const applyFilters = (overrides: Partial<typeof currentFilters>) => {
    const params = new URLSearchParams();
    const next = { ...currentFilters, ...overrides };
    if (next.q) params.set("q", next.q);
    if (next.tag) params.set("tag", next.tag);
    if (next.channel) params.set("channel", next.channel);
    router.push(`/contacts${params.toString() ? "?" + params.toString() : ""}`);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Contactos</h1>
          <p className="text-sm text-muted-foreground">
            {contacts.length} {contacts.length === 1 ? "contacto" : "contactos"} en este workspace
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar CSV
          </Button>
          <Button onClick={() => setShowNew(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo contacto
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={onSearch} className="flex gap-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nombre, email, teléfono…"
              className="w-72 pl-8"
            />
          </div>
          <Button type="submit" variant="outline" size="sm">
            Buscar
          </Button>
        </form>

        {channels.length > 0 && (
          <div className="flex items-center gap-1">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            {(["whatsapp", "facebook", "instagram"] as const).map((t) => {
              const active = currentFilters.channel === t;
              return (
                <button
                  key={t}
                  onClick={() => applyFilters({ channel: active ? "" : t })}
                  className={`rounded-full border px-2.5 py-0.5 text-xs ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {CHANNEL_LABELS[t]?.label}
                </button>
              );
            })}
          </div>
        )}

        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {allTags.map((t) => {
              const active = currentFilters.tag === t;
              return (
                <button
                  key={t}
                  onClick={() => applyFilters({ tag: active ? "" : t })}
                  className={`rounded-md border px-2 py-0.5 text-xs ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  #{t}
                </button>
              );
            })}
          </div>
        )}

        {(currentFilters.q || currentFilters.tag || currentFilters.channel) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => applyFilters({ q: "", tag: "", channel: "" })}
            className="text-muted-foreground"
          >
            <X className="mr-1 h-3 w-3" />
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* Table or empty state */}
      {contacts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="rounded-full bg-muted p-3">
              <MessageCircle className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">
                {currentFilters.q || currentFilters.tag || currentFilters.channel
                  ? "Sin resultados con esos filtros"
                  : "Sin contactos aún"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {currentFilters.q || currentFilters.tag || currentFilters.channel
                  ? "Prueba limpiar los filtros."
                  : "Los contactos se crean automáticamente al recibir mensajes, o puedes crearlos manualmente."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">Nombre</th>
                  <th className="px-4 py-2.5">Contacto</th>
                  <th className="px-4 py-2.5">Canales</th>
                  <th className="px-4 py-2.5">Tags</th>
                  <th className="px-4 py-2.5">Última actividad</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {contacts.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      <Link
                        href={`/contacts/${c.id}`}
                        className="block text-foreground hover:underline"
                      >
                        {c.full_name ?? <span className="text-muted-foreground">—</span>}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {c.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {c.email}
                        </div>
                      )}
                      {c.phone_e164 && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {c.phone_e164}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {c.channels.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          c.channels.map((ch, i) => (
                            <span
                              key={i}
                              className={`rounded px-1.5 py-0.5 text-[10px] ${
                                CHANNEL_LABELS[ch.type]?.color ?? "bg-muted"
                              }`}
                            >
                              {CHANNEL_LABELS[ch.type]?.label ?? ch.type}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {c.tags.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          c.tags.map((t) => (
                            <Badge key={t} variant="secondary" className="text-[10px]">
                              #{t}
                            </Badge>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(c.lastActivity).toLocaleString("es", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modals */}
      <NewContactDialog open={showNew} onOpenChange={setShowNew} />
      <ImportCSVDialog open={showImport} onOpenChange={setShowImport} />
    </div>
  );
}

function ImportCSVDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (b: boolean) => void }) {
  const [csvText, setCsvText] = useState("");
  const [isPending, startTransition] = useTransition();

  const onImport = () => {
    if (!csvText.trim()) {
      toast.error("Pega tu CSV con al menos una fila");
      return;
    }
    startTransition(async () => {
      try {
        const Papa = (await import("papaparse")).default;
        const parsed = Papa.parse<Record<string, string>>(csvText.trim(), {
          header: true,
          skipEmptyLines: true,
        });
        if (parsed.errors.length > 0) {
          toast.error(`Error parseando CSV: ${parsed.errors[0]?.message ?? "formato inválido"}`);
          return;
        }
        const rows = parsed.data.map((r) => ({
          full_name: r.full_name || r.name || r.nombre,
          email: r.email || r.correo,
          phone_e164: r.phone_e164 || r.phone || r.telefono,
          tags: r.tags || r.etiquetas,
          notes: r.notes || r.notas,
        }));
        const res = await importContactsAction({ rows });
        if (res.error) {
          toast.error(res.error);
          return;
        }
        toast.success(
          `${res.imported ?? 0} importados, ${res.skipped ?? 0} saltados (duplicados o vacíos)`,
        );
        onOpenChange(false);
        setCsvText("");
      } catch (e) {
        toast.error("Error al parsear el CSV");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar contactos desde CSV</DialogTitle>
          <DialogDescription>
            Primera fila debe ser el header. Columnas:{" "}
            <code className="rounded bg-muted px-1">full_name</code>,{" "}
            <code className="rounded bg-muted px-1">email</code>,{" "}
            <code className="rounded bg-muted px-1">phone_e164</code> (formato +50433330274),{" "}
            <code className="rounded bg-muted px-1">tags</code> (separados por coma),{" "}
            <code className="rounded bg-muted px-1">notes</code>
          </DialogDescription>
        </DialogHeader>
        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          rows={10}
          placeholder="full_name,email,phone_e164,tags,notes&#10;Juan Pérez,juan@example.com,+50499999999,cliente vip,Prefiere WhatsApp"
          className="w-full rounded-md border bg-background p-3 font-mono text-xs"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onImport} disabled={isPending || !csvText.trim()}>
            {isPending ? "Importando…" : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}