"use client";

// Embedded Signup v4: Facebook JS SDK popup + postMessage listener
// Docs: https://developers.secure.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation/

declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

const FB_SDK_URL = "https://connect.facebook.net/en_US/sdk.js";

function loadFacebookSdk(appId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no window"));
    if (window.FB) return resolve();

    // Set up fbAsyncInit before script loads
    window.fbAsyncInit = () => {
      window.FB.init({
        appId,
        cookie: true,
        xfbml: true,
        version: "v22.0",
      });
      resolve();
    };

    // Inject script if not already present
    if (!document.querySelector(`script[src="${FB_SDK_URL}"]`)) {
      const script = document.createElement("script");
      script.src = FB_SDK_URL;
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      script.onerror = () => reject(new Error("Failed to load FB SDK"));
      document.head.appendChild(script);
    }
  });
}

export type EmbeddedSignupResult =
  | { ok: true; data: any }
  | { ok: false; error: string };

export async function launchEmbeddedSignup(args: {
  appId: string;
  configId: string;
}): Promise<EmbeddedSignupResult> {
  if (!args.configId || args.configId.startsWith("<")) {
    return {
      ok: false,
      error:
        "Falta NEXT_PUBLIC_META_CONFIG_ID en .env.local. Cr\u00e9alo en Meta for Developers \u2192 tu app \u2192 Facebook Login for Business \u2192 Configurations.",
    };
  }

  try {
    await loadFacebookSdk(args.appId);
  } catch (e) {
    return { ok: false, error: `No se pudo cargar el SDK de Facebook: ${(e as Error).message}` };
  }

  // Set up postMessage listener BEFORE launching popup
  const messagePromise = new Promise<any>((resolve) => {
    const handler = (event: MessageEvent) => {
      if (!event.origin || !event.origin.endsWith("facebook.com")) return;
      try {
        const data = JSON.parse(event.data);
        if (data?.type === "WA_EMBEDDED_SIGNUP") {
          if (data.event === "FINISH" || data.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING") {
            window.removeEventListener("message", handler);
            resolve(data.data);
          } else if (data.event === "ERROR") {
            window.removeEventListener("message", handler);
            resolve({ error: data.data?.error_message ?? "Error en Embedded Signup" });
          }
          // Ignore CANCEL events — user can retry
        }
      } catch {
        // Not JSON, ignore
      }
    };
    window.addEventListener("message", handler);
    // Timeout after 5 minutes
    setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve({ error: "Embedded Signup tard\u00f3 demasiado" });
    }, 5 * 60 * 1000);
  });

  return new Promise((resolve) => {
    if (!window.FB) {
      resolve({ ok: false, error: "FB SDK no disponible" });
      return;
    }

    window.FB.login(
      (response: any) => {
        if (response.status !== "connected" || !response.authResponse) {
          // User cancelled — wait for postMessage or resolve as cancelled
          resolve({ ok: false, error: "Login cancelado" });
          return;
        }
        const code = response.authResponse.code as string;
        // Wait for the postMessage FINISH event with the assets
        messagePromise.then((data) => {
          if (data?.error) {
            resolve({ ok: false, error: data.error });
            return;
          }
          resolve({
            ok: true,
            data: {
              code,
              phone_number_id: data.phone_number_id,
              waba_id: data.waba_id,
              business_id: data.business_id ?? data.businessId,
            },
          });
        });
      },
      {
        config_id: args.configId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          features: [{ name: "marketing_messages_lite" }],
          sessionInfoVersion: "3",
        },
      },
    );
  });
}