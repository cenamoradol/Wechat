"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, X, Trash2, Save, Mail, Phone, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  updateContactAction,
  deleteContactAction,
} from "@/app/(workspace)/contacts/actions";

type Contact = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone_e164: string | null;
  notes: string | null;
  tags: string[];
  channels: Array<{
    id: string;
    external_user_id: string;
    last_seen_at: string | null;
    type: string | null;
    display_name: string | null;
  }>;
  created_at: string;
};

type Conversation = {
  id: string;
  status: string;
  last_message_at: string;
  last_message_preview: string | null;
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  facebook: "Messenger",
  instagram: "Instagram",
};

export function ContactDetailView({
  contact,
  conversations,
}: {
  contact: Contact;
  conversations: Conversation[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  // Editable form state
  const [fullName, setFullName] = useState(contact.full_name ?? "");
  const [email, setEmail] = useState(contact.email ?? "");
  const [phone, setPhone] = useState(contact.phone_e164 ?? "");
  const [notes, setNotes] = useState(contact.notes ?? "");
  const [tags, setTags] = useState<string[]>(contact.tags);
  const [tagInput, setTagInput] = useState("");

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t) && t.length <= 40) {
      setTags([...tags, t]);
      setTagInput("");
      toast.success(`Tag "${t}" agregado`);
    }
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const parts = tagInput.split(",").map((p) => p.trim().toLowerCase()).filter(Boolean);
      if (parts.length > 1) {
        const newTags = [...tags];
        for (const p of parts) {
          if (!newTags.includes(p) && p.length <= 40) newTags.push(p);
        }
        setTags(newTags);
        setTagInput("");
        toast.success(`${newTags.length - tags.length} tag(s) agregados`);
      } else {
        addTag();
      }
    }
  };

  const onSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateContactAction(contact.id, {
        full_name: fullName.trim() || null,
        email: email.trim() || null,
        phone_e164: phone.trim() || null,
        notes: notes.trim() || null,
        tags,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Contacto actualizado");
      setEditing(false);
    });
  };

  const onDelete = () => {
    if (
      !confirm(
        `¿Eliminar a "${contact.full_name ?? contact.email ?? contact.phone_e164 ?? "este contacto"}"?\n\nLas conversaciones existentes NO se borrarán pero quedarán sin contacto asociado.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await deleteContactAction(contact.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Contacto eliminado");
      router.push("/contacts");
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href="/contacts"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
            Contactos
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">
            {contact.full_name ?? <span className="text-muted-foreground">Sin nombre</span>}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {contact.email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {contact.email}
              </span>
            )}
            {contact.phone_e164 && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {contact.phone_e164}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {!editing && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              Editar
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            disabled={isPending}
            title="Eliminar"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Edit / View */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Información</CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <form onSubmit={onSave} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="full_name">Nombre</Label>
                  <Input
                    id="full_name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+50433330274"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Notas</Label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border bg-background p-2 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tags</Label>
                <div className="flex gap-1">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    onBlur={() => {
                      if (tagInput.trim()) addTag();
                    }}
                    placeholder="Escribe un tag y presiona Enter…"
                  />
                  <Button type="button" variant="outline" onClick={addTag}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Pega varios separados por coma: "vip, hot, cliente"
                </p>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 rounded-full border bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-900"
                      >
                        #{t}
                        <button
                          type="button"
                          onClick={() => setTags(tags.filter((x) => x !== t))}
                          className="ml-0.5 rounded-full p-0.5 hover:bg-blue-100"
                          title={`Quitar ${t}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending}>
                  <Save className="mr-2 h-4 w-4" />
                  {isPending ? "Guardando…" : "Guardar"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-3 text-sm">
              <Row label="Email" value={contact.email} />
              <Row label="Teléfono" value={contact.phone_e164} />
              <Row label="Notas" value={contact.notes} multiline />
              {contact.tags.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground">Tags</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {contact.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">
                        #{t}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Channels */}
      {contact.channels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Canales vinculados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {contact.channels.map((ch) => (
              <div
                key={ch.id}
                className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium">
                    {CHANNEL_LABELS[ch.type ?? ""] ?? ch.type}{" "}
                    {ch.display_name && (
                      <span className="text-muted-foreground">— {ch.display_name}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ID: <code>{ch.external_user_id}</code>
                  </div>
                </div>
                {ch.last_seen_at && (
                  <div className="text-xs text-muted-foreground">
                    Visto:{" "}
                    {new Date(ch.last_seen_at).toLocaleString("es", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Conversations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">
            Conversaciones ({conversations.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {conversations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin conversaciones aún.</p>
          ) : (
            <ul className="divide-y">
              {conversations.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/inbox?conversation=${c.id}`}
                    className="flex items-center justify-between gap-3 py-2 hover:bg-muted/30"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        {c.last_message_preview ?? <em className="text-muted-foreground">Sin mensajes</em>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(c.last_message_at).toLocaleString("es", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        · {c.status}
                      </p>
                    </div>
                    <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, multiline }: { label: string; value: string | null; multiline?: boolean }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div
        className={
          multiline ? "mt-1 whitespace-pre-wrap text-sm text-foreground" : "mt-0.5 text-sm text-foreground"
        }
      >
        {value ?? <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}