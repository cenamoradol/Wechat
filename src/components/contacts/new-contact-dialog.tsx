"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createContactAction } from "@/app/(workspace)/contacts/actions";

export function NewContactDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const reset = () => {
    setFullName("");
    setEmail("");
    setPhone("");
    setNotes("");
    setTags([]);
    setTagInput("");
  };

  const close = () => {
    onOpenChange(false);
    reset();
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t) && t.length <= 40) {
      setTags([...tags, t]);
      setTagInput("");
      toast.success(`Tag "${t}" agregado`);
    }
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Add on Enter OR on comma (so users can paste "vip, hot, lead")
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      // If they typed "vip, hot", split by comma and add all
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

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createContactAction({
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
      toast.success("Contacto creado");
      close();
      if (res.id) router.push(`/contacts/${res.id}`);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo contacto</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Nombre</Label>
            <Input
              id="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Juan Pérez"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="juan@example.com"
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
            <Label htmlFor="notes">Notas</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border bg-background p-2 text-sm"
              placeholder="Preferencias, contexto, recordatorios…"
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
                  // Auto-add tag if user clicks away with text
                  if (tagInput.trim()) addTag();
                }}
                placeholder="Escribe un tag y presiona Enter…"
              />
              <Button type="button" variant="outline" onClick={addTag}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              También puedes pegar varios separados por coma: "vip, hot, cliente"
            </p>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
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
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creando…" : "Crear contacto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}