"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  getPushStateAction,
  registerPushAction,
  unregisterPushAction,
  updatePrefsAction,
  type PrefsResult,
} from "@/app/(workspace)/settings/notifications/actions";

type Prefs = {
  new_message: boolean;
  conversation_assigned: boolean;
  automation_failed: boolean;
  ai_handoff: boolean;
  new_contact: boolean;
};

const TOGGLES: Array<{ key: keyof Prefs; title: string; description: string }> = [
  {
    key: "new_message",
    title: "Mensaje nuevo en conversación asignada a mí",
    description: "Push cuando llega un mensaje en una conversación que tengo.",
  },
  {
    key: "conversation_assigned",
    title: "Conversación asignada a mí",
    description: "Push cuando alguien me asigna una conversación.",
  },
  {
    key: "automation_failed",
    title: "Automatización falló",
    description: "Push si una automatización del workspace falla.",
  },
  {
    key: "ai_handoff",
    title: "IA necesita handoff",
    description: "Push cuando un agente IA pide pasar la conversación a un humano.",
  },
  {
    key: "new_contact",
    title: "Nuevo contacto creado",
    description: "Push cuando se crea un nuevo contacto en el workspace.",
  },
];

const DEFAULTS: Prefs = {
  new_message: true,
  conversation_assigned: true,
  automation_failed: true,
  ai_handoff: true,
  new_contact: false,
};

export function NotificationsForm() {
  const [mounted, setMounted] = useState(false);
  const [serverEnabled, setServerEnabled] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [pending, startTransition] = useTransition();
  const [subPending, startSub] = useTransition();

  useEffect(() => {
    setMounted(true);
    startTransition(async () => {
      const state = await getPushStateAction();
      setServerEnabled(state.serverEnabled);
      setSubscribed(state.subscribed);
      setPrefs({ ...DEFAULTS, ...state.prefs });
    });

    // Register the service worker on mount so we can subscribe later
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((e) => {
        console.error("[notifications] SW register failed", e);
      });
    }
  }, []);

  function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    const out = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) out[i] = rawData.charCodeAt(i);
    return out;
  }

  const onTogglePush = async () => {
    if (!("serviceWorker" in navigator)) {
      toast.error("Tu navegador no soporta notificaciones push");
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      toast.error("Falta NEXT_PUBLIC_VAPID_PUBLIC_KEY en el servidor");
      return;
    }

    startSub(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          toast.error("Permiso denegado");
          return;
        }
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
          });
        }
        const res = await registerPushAction({
          subscription: sub.toJSON() as any,
        });
        if (res.error) {
          toast.error(res.error);
          return;
        }
        setSubscribed(true);
        toast.success("Notificaciones push activadas");
      } catch (e) {
        toast.error((e as Error).message ?? "No se pudo activar push");
      }
    });
  };

  const onUnsubscribe = () => {
    startSub(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
        await unregisterPushAction();
        setSubscribed(false);
        toast.success("Notificaciones desactivadas");
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  };

  const onPrefChange = (key: keyof Prefs, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    startTransition(async () => {
      const res: PrefsResult = await updatePrefsAction({ prefs: next });
      if (res.error) {
        toast.error(res.error);
        setPrefs(prefs); // revert
      } else {
        toast.success("Preferencias guardadas", { duration: 1500 });
      }
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Notificaciones</h1>
        <p className="text-sm text-muted-foreground">
          Qué te avisamos y cómo, incluso cuando no estés mirando la app.
        </p>
      </div>

      {/* Push status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {subscribed ? (
              <Bell className="h-4 w-4 text-green-600" />
            ) : (
              <BellOff className="h-4 w-4 text-muted-foreground" />
            )}
            Notificaciones push del navegador
          </CardTitle>
          <CardDescription>
            Te llegan aunque tengas la pestaña cerrada o estés en otra app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!mounted ? (
            <div className="text-sm text-muted-foreground">Cargando…</div>
          ) : !serverEnabled ? (
            <p className="text-sm text-amber-700">
              El servidor no tiene claves VAPID configuradas. El owner debe
              agregar <code className="rounded bg-muted px-1">NEXT_PUBLIC_VAPID_PUBLIC_KEY</code>{" "}
              y <code className="rounded bg-muted px-1">VAPID_PRIVATE_KEY</code>.
            </p>
          ) : subscribed ? (
            <div className="flex items-center justify-between gap-3 rounded-md border bg-green-50 p-3 text-sm">
              <div className="flex items-center gap-2 text-green-800">
                <Check className="h-4 w-4" />
                Activadas en este navegador.
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={subPending}
                onClick={onUnsubscribe}
              >
                {subPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Desactivar"}
              </Button>
            </div>
          ) : (
            <Button onClick={onTogglePush} disabled={subPending}>
              {subPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Activando…
                </>
              ) : (
                <>
                  <Bell className="mr-2 h-4 w-4" />
                  Activar notificaciones push
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Per-event toggles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eventos</CardTitle>
          <CardDescription>
            Elegí qué tipo de eventos te generan un push cuando estés fuera de la app.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {TOGGLES.map((t, i) => (
            <div key={t.key} className={`flex items-start justify-between gap-4 py-4 ${i === 0 ? "pt-0" : ""}`}>
              <div>
                <div className="font-medium">{t.title}</div>
                <p className="text-sm text-muted-foreground">{t.description}</p>
              </div>
              <label className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={prefs[t.key]}
                  disabled={!mounted || pending}
                  onChange={(e) => onPrefChange(t.key, e.target.checked)}
                />
                <span className="h-6 w-11 rounded-full bg-muted transition-colors peer-checked:bg-primary peer-disabled:opacity-50" />
                <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform peer-checked:translate-x-5" />
              </label>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}