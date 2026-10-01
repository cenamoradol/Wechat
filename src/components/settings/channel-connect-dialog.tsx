"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, ExternalLink, Smartphone, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { connectWhatsAppManualAction } from "@/app/(workspace)/settings/channels/actions";
import { completeEmbeddedSignupV4Action } from "@/app/(workspace)/settings/channels/v4-actions";
import { launchEmbeddedSignup } from "@/lib/meta/embedded-signup";

const APP_ID = process.env.NEXT_PUBLIC_META_APP_ID ?? "";
const CONFIG_ID = process.env.NEXT_PUBLIC_META_CONFIG_ID ?? "";
const HAS_CONFIG = !!(CONFIG_ID && !CONFIG_ID.startsWith("<"));

export function ChannelConnectDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>+ Conectar canal</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Conectar canal</DialogTitle>
          <DialogDescription>
            Conecta WhatsApp, Facebook Messenger e Instagram en un solo paso (Embedded Signup v4)
            o de forma manual.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="v4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="v4">Embedded Signup v4</TabsTrigger>
            <TabsTrigger value="whatsapp-manual">WhatsApp manual</TabsTrigger>
            <TabsTrigger value="legacy">FB + IG (legacy)</TabsTrigger>
          </TabsList>

          <TabsContent value="v4" className="pt-4">
            <EmbeddedSignupV4Flow onSuccess={() => setOpen(false)} />
          </TabsContent>

          <TabsContent value="whatsapp-manual" className="pt-4">
            <WhatsAppManualForm onSuccess={() => setOpen(false)} />
          </TabsContent>

          <TabsContent value="legacy" className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              OAuth básico (sin Embedded Signup). Solo para FB + IG. No usa config_id.
            </p>
            <Button asChild className="w-full">
              <a href="/api/oauth/meta/start">
                <ExternalLink className="mr-2 h-4 w-4" />
                Conectar con Facebook
              </a>
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function EmbeddedSignupV4Flow({ onSuccess }: { onSuccess: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<string>("");

  const onLaunch = () => {
    setStatus("");
    startTransition(async () => {
      setStatus("Abriendo popup de Meta…");
      const res = await launchEmbeddedSignup({ appId: APP_ID, configId: CONFIG_ID });
      if (!res.ok) {
        setStatus("");
        toast.error(res.error);
        return;
      }
      setStatus("Code recibido, guardando canales…");
      const save = await completeEmbeddedSignupV4Action(res.data);
      if (save.error) {
        setStatus("");
        toast.error(save.error);
        return;
      }
      setStatus("");
      toast.success(`Conectado: ${save.saved ?? 0} canal(es)`);
      onSuccess();
    });
  };

  if (!HAS_CONFIG) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="space-y-2 text-xs">
          <p>
            <strong>Falta NEXT_PUBLIC_META_CONFIG_ID</strong> en tu <code>.env.local</code>.
          </p>
          <p>Para crearlo:</p>
          <ol className="list-decimal pl-4 space-y-1">
            <li>
              Ve a <strong>developers.facebook.com → tu app → Facebook Login for Business →
              Configurations</strong>
            </li>
            <li>
              Click <strong>Create from template</strong> → elige{" "}
              <em>"WhatsApp Embedded Signup Configuration"</em>
            </li>
            <li>Selecciona WhatsApp + Messenger + Instagram</li>
            <li>Configura el redirect URI: <code>http://localhost:3000/api/oauth/meta/callback</code></li>
            <li>Copia el <code>config_id</code> generado y pégalo en <code>.env.local</code></li>
          </ol>
          <p className="pt-2">
            Mientras tanto, usa el tab <strong>"WhatsApp manual"</strong> para conectar tu WA
            directamente.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Se abrirá un popup de Facebook. Inicia sesión con la cuenta que administra tu Business
          Manager, elige la Página de Facebook, vincula Instagram (si aplica) y crea/selecciona
          tu WhatsApp Business Account.
        </AlertDescription>
      </Alert>

      <Button onClick={onLaunch} disabled={isPending} className="w-full">
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        <Smartphone className="mr-2 h-4 w-4" />
        Conectar con Facebook (v4)
      </Button>

      {status && <p className="text-xs text-muted-foreground">{status}</p>}
    </div>
  );
}

function WhatsAppManualForm({ onSuccess }: { onSuccess: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const phone_number_id = String(fd.get("phone_number_id") ?? "").trim();
    const waba_id = String(fd.get("waba_id") ?? "").trim();
    const access_token = String(fd.get("access_token") ?? "").trim();
    const display_name = String(fd.get("display_name") ?? "").trim();

    if (!phone_number_id || !waba_id || !access_token) {
      setError("Todos los campos son requeridos");
      return;
    }

    startTransition(async () => {
      try {
        const res = await connectWhatsAppManualAction({
          phone_number_id,
          waba_id,
          access_token,
          display_name: display_name || `WA ${phone_number_id.slice(-6)}`,
        });
        if (res?.error) {
          setError(res.error);
          toast.error(res.error);
        } else {
          toast.success("WhatsApp conectado");
          onSuccess();
        }
      } catch (e) {
        if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
        const msg = e instanceof Error ? e.message : "Error inesperado";
        setError(msg);
        toast.error(msg);
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Ve a <strong>developers.facebook.com → tu app → WhatsApp → API Setup</strong> para obtener
          estos valores. El access token permanente lo creas en
          <strong> business.facebook.com/settings → System Users</strong>.
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        <Label htmlFor="phone_number_id">Phone Number ID</Label>
        <Input id="phone_number_id" name="phone_number_id" placeholder="123456789012345" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="waba_id">WhatsApp Business Account ID (WABA ID)</Label>
        <Input id="waba_id" name="waba_id" placeholder="123456789012345" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="access_token">Access Token (permanente)</Label>
        <Input
          id="access_token"
          name="access_token"
          type="password"
          placeholder="EAAxxxxxx..."
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="display_name">Nombre para mostrar (opcional)</Label>
        <Input id="display_name" name="display_name" placeholder="WhatsApp Principal" />
      </div>

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Conectando…" : "Conectar WhatsApp"}
      </Button>
    </form>
  );
}