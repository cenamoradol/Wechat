"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Upload,
  Search,
  X,
  MessageCircle,
  Mail,
  Phone,
  Filter,
  Download,
  Tag,
} from "lucide-react";
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
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  importContactsAction,
  bulkTagContactsAction,
} from "@/app/(workspace)/contacts/actions";
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
type Workspace = { id: string; name: string; slug: string; role: string };

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
  workspaces,
  activeWorkspaceId,
  targetWorkspaceId,
}: {
  contacts: Contact[];
  channels: Channel[];
  allTags: string[];
  currentFilters: { q: string; tag: string; channel: string };
  workspaces: Workspace[];
  activeWorkspaceId: string;
  targetWorkspaceId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(currentFilters.q);
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showBulkTag, setShowBulkTag] = useState(false);

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allChecked = useMemo(
    () => contacts.length > 0 && contacts.every((c) => selected.has(c.id)),
    [contacts, selected],
  );
  const someChecked = useMemo(
    () => contacts.some((c) => selected.has(c.id)),
    [contacts, selected],
  );
  const toggleAll = () => {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(contacts.map((c) => c.id)));
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyFilters = (overrides: Partial<typeof currentFilters>) => {
    const params = new URLSearchParams();
    const next = { ...currentFilters, ...overrides };
    if (next.q) params.set("q", next.q);
    if (next.tag) params.set("tag", next.tag);
    if (next.channel) params.set("channel", next.channel);
    if (targetWorkspaceId !== activeWorkspaceId) {
      params.set("workspace", targetWorkspaceId);
    }
    router.push(`/contacts${params.toString() ? "?" + params.toString() : ""}`);
  };

  const onSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    applyFilters({ q: search.trim() });
  };

  const switchWorkspace = (id: string) => {
    const params = new URLSearchParams();
    params.set("workspace", id);
    if (currentFilters.q) params.set("q", currentFilters.q);
    if (currentFilters.tag) params.set("tag", currentFilters.tag);
    if (currentFilters.channel) params.set("channel", currentFilters.channel);
    router.push(`/contacts?${params.toString()}`);
  };

  const exportCSV = () => {
    const rows = selected.size > 0 ? contacts.filter((c) => selected.has(c.id)) : contacts;
    if (rows.length === 0) {
      toast.error("No hay contactos para exportar");
      return;
    }
    const header = ["full_name", "email", "phone_e164", "tags", "notes", "last_activity"];
    const lines = [header.join(",")];
    for (const c of rows) {
      const row = [
        c.full_name ?? "",
        c.email ?? "",
        c.phone_e164 ?? "",
        c.tags.join(";"),
        c.notes ?? "",
        new Date(c.lastActivity).toISOString(),
      ].map((v) => `"${String(v).replaceAll('"', '""')}"`);
      lines.push(row.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contactos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} contactos exportados`);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Contactos</h1>
          <p className="text-sm text-muted-foreground">
            {contacts.length} {contacts.length === 1 ? "contacto" : "contactos"}
            {targetWorkspaceId !== activeWorkspaceId && (
              <span className="ml-1 italic">(en otro workspace — no es el activo)</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {selected.size > 0 ? (
            <>
              <Button variant="outline" onClick={() => setShowBulkTag(true)}>
                <Tag className="mr-2 h-4 w-4" />
                Tags ({selected.size})
              </Button>
              <Button onClick={exportCSV}>
                <Download className="mr-2 h-4 w-4" />
                Exportar selección
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={exportCSV}
              disabled={contacts.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar
          </Button>
          <Button onClick={() => setShowNew(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo
          </Button>
        </div>
      </div>

      {/* Workspace switcher (chip) — only if more than 1 */}
      {workspaces.length > 1 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs text-muted-foreground">Workspace:</span>
          {workspaces.map((w) => {
            const active = w.id === targetWorkspaceId;
            const isMain = w.id === activeWorkspaceId;
            return (
              <button
                key={w.id}
                onClick={() => switchWorkspace(w.id)}
                className={`rounded-full border px-2.5 py-0.5 text-xs ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {w.name}
                {isMain && <span className="ml-1 opacity-70">·activo</span>}
              </button>
            );
          })}
        </div>
      )}

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
                  : "Sin contactos aún en este workspace"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {currentFilters.q || currentFilters.tag || currentFilters.channel
                  ? "Prueba limpiar los filtros o cambiar de workspace arriba."
                  : "Los contactos se crean automáticamente al recibir mensajes."}
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
                  <th className="w-10 px-2 py-2.5">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      ref={(el) => {
                        if (el) el.indeterminate = !allChecked && someChecked;
                      }}
                      onChange={toggleAll}
                      aria-label="Seleccionar todos"
                    />
                  </th>
                  <th className="px-4 py-2.5">Nombre</th>
                  <th className="px-4 py-2.5">Contacto</th>
                  <th className="px-4 py-2.5">Canales</th>
                  <th className="px-4 py-2.5">Tags</th>
                  <th className="px-4 py-2.5">Última actividad</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {contacts.map((c) => {
                  const isSelected = selected.has(c.id);
                  return (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/contacts/${c.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(`/contacts/${c.id}`);
                        }
                      }}
                      tabIndex={0}
                      className={`cursor-pointer transition-colors hover:bg-muted/50 focus:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-inset ${isSelected ? "bg-blue-50/50" : ""}`}
                    >
                      <td
                        className="w-10 px-2 py-3 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(c.id)}
                          aria-label={`Seleccionar ${c.full_name ?? c.email ?? c.phone_e164 ?? c.id}`}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {c.full_name ?? <span className="text-muted-foreground">—</span>}
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modals */}
      <NewContactDialog open={showNew} onOpenChange={setShowNew} />
      <ImportCSVDialog open={showImport} onOpenChange={setShowImport} />
      <BulkTagDialog
        open={showBulkTag}
        onOpenChange={setShowBulkTag}
        selectedIds={Array.from(selected)}
        existingTags={allTags}
        onDone={() => {
          setSelected(new Set());
          setShowBulkTag(false);
          router.refresh();
        }}
      />
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

function BulkTagDialog({
  open,
  onOpenChange,
  selectedIds,
  existingTags,
  onDone,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  selectedIds: string[];
  existingTags: string[];
  onDone: () => void;
}) {
  const [tagsToAdd, setTagsToAdd] = useState("");
  const [tagsToRemove, setTagsToRemove] = useState("");
  const [isPending, startTransition] = useTransition();

  const onApply = () => {
    if (!tagsToAdd.trim() && !tagsToRemove.trim()) {
      toast.error("Escribe al menos un tag para agregar o quitar");
      return;
    }
    startTransition(async () => {
      const res = await bulkTagContactsAction({
        contactIds: selectedIds,
        tagsToAdd: tagsToAdd
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
        tagsToRemove: tagsToRemove
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.updated} contactos actualizados`);
      setTagsToAdd("");
      setTagsToRemove("");
      onDone();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tags en masa ({selectedIds.length} contactos)</DialogTitle>
          <DialogDescription>
            Tags existentes:{" "}
            {existingTags.length > 0 ? existingTags.map((t) => `#${t}`).join(", ") : "(ninguno)"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="tagsAdd">Agregar tags (separados por coma)</Label>
            <Input
              id="tagsAdd"
              value={tagsToAdd}
              onChange={(e) => setTagsToAdd(e.target.value)}
              placeholder="vip, hot, cliente-recurrente…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tagsRemove">Quitar tags (separados por coma)</Label>
            <Input
              id="tagsRemove"
              value={tagsToRemove}
              onChange={(e) => setTagsToRemove(e.target.value)}
              placeholder="spam, inactivo…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onApply} disabled={isPending}>
            {isPending ? "Aplicando…" : "Aplicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}