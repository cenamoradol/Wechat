# Setup de Meta (Facebook) para Wechat

Guía completa para configurar la app de Meta para usar con Wechat. **Si te equivocas, vuelve a esta guía**.

## 📋 Lo que ya tienes (conservar)

| Recurso | ID | Notas |
|---|---|---|
| **Business Manager** | "Buho Digital" (portfolio comercial) | NO se borra al crear/borrar apps |
| **System User "admin"** | `61592458953927` | ES EL CORRECTO. Tiene 6 assets asignados |
| **Página de Facebook** | "PM Solution" — ID `1318350018035126` | Se conserva |
| **Página publicitaria** | "PM Solutions Cuenta Publicitaria" | Se conserva |
| **Instagram Business** | `@pmsolutionshn` | Se conserva |
| **WhatsApp WABA** | `2017363685552310` — "PMSolution" | Se conserva |
| **WhatsApp Phone** | `+504 3333-0274` (Honduras) | Se conserva |

## ❌ Lo que se perdió

- **App de Meta** "Wechat" (id anterior `2114975212479283`) — **hay que recrearla**

---

## 🛠 Paso a paso para recrear la app

### 1. Crear la app

1. Ve a [developers.facebook.com](https://developers.facebook.com)
2. Click **"Mis Apps"** → **"Crear app"**
3. Tipo: **"Business"** ← IMPORTANTE: Business, no Consumer ni Other
4. Nombre de la app: **"Wechat"** (o el que prefieras)
5. Email de contacto: tu email
6. Click **"Crear app"** → completa captcha

### 2. Guarda el nuevo `App ID` y `App Secret`

En la página principal de tu nueva app, arriba verás:

- **App ID**: un número largo, ej. `987654321098765` — **GUÁRDALO**
- **App Secret**: click "Mostrar" → requiere tu password de Facebook → copia el valor — **GUÁRDALO**

### 3. Añadir los 3 productos

En la página de tu app → sidebar izquierdo → **"Add Product"** (o "Agregar producto"):

- ✅ **WhatsApp** (Messenger setup incluye este producto)
- ✅ **Messenger**
- ✅ **Instagram**

### 4. Configurar WhatsApp (vía Embedded Signup)

1. Sidebar → **WhatsApp → API Setup**
2. Verás tu número de prueba `+1 555-xxxx` (no importa, lo borraremos)
3. **NO uses el token temporal de aquí** — usa el del System User (paso 6)
4. Guarda el **Phone Number ID** y **WABA ID** que ya tienes:
   - Phone Number ID: `1276692908855446`
   - WABA ID: `2017363685552310`

### 5. Crear la Embedded Signup Configuration (para OAuth)

1. Sidebar → **Facebook Login for Business → Configurations** (o busca "Embedded Signup")
2. Click **"Create from template"** o **"Create configuration"**
3. Nombre: "Wechat OAuth"
4. Selecciona productos: **WhatsApp + Messenger + Instagram**
5. Permisos a pedir:
   ```
   business_management
   pages_show_list
   pages_messaging
   instagram_basic
   instagram_manage_messages
   whatsapp_business_management
   whatsapp_business_messaging
   ```
6. **Valid OAuth Redirect URIs** → agregar:
   ```
   http://localhost:3000/api/oauth/meta/callback
   https://wechat-eight-sigma.vercel.app/api/oauth/meta/callback
   ```
   (el segundo es para producción)
7. Click **"Generate"** → copia el **`config_id`** generado

### 6. Vincular la app al Business Manager "Buho Digital"

1. Ve a [business.facebook.com/settings/accounts](https://business.facebook.com/settings/accounts)
2. Click **"Apps"** → **"Add"**
3. Busca tu nueva app por nombre o ID
4. Click **"Add"**
5. Verifica que la app aparece listada en "Apps"

### 7. Asignar el System User correcto a la nueva app

1. Ve a [business.facebook.com/settings/users](https://business.facebook.com/settings/users)
2. Click en **System User "admin"** con ID `61592458953927` (NO el otro)
3. En la sección **"Apps"** → click **"Add Apps"**
4. Selecciona tu nueva app "Wechat"
5. **Full Control** → Save
6. Verifica que la app aparece en "Apps" con check verde

### 8. Generar el System User Token (CRÍTICO — desde el User correcto)

1. Sigue en la página del System User `61592458953927`
2. Click **"Generate New Token"**
3. **App**: selecciona tu nueva app "Wechat"
4. **Marca estos 7 scopes**:
   - ✅ business_management
   - ✅ pages_show_list
   - ✅ pages_messaging
   - ✅ instagram_basic
   - ✅ instagram_manage_messages
   - ✅ whatsapp_business_management
   - ✅ whatsapp_business_messaging
5. **Expiración**: "Never" (o la más larga)
6. Click **"Generate Token"** → copia el `EAAxxxxxxx...` LARGO

⚠️ **CRÍTICO**: Verifica que el ID del System User (mostrado en la página) es `61592458953927`. Si dice otro, estás en el System User equivocado.

### 9. Configurar el webhook URL (DESPUÉS de deployar a Vercel)

Una vez que Vercel tenga la nueva app desplegada, los webhooks se configuran desde Wechat (botón "Re-suscribir webhooks"). Si lo quieres hacer manual:

1. [developers.facebook.com](https://developers.facebook.com) → tu app
2. Sidebar → **Webhooks** → **"Add Subscription"** o configurar producto
3. Para cada producto (WhatsApp, Messenger/Instagram):

   **WhatsApp Business Account:**
   - Callback URL: `https://wechat-eight-sigma.vercel.app/api/webhooks/whatsapp`
   - Verify Token: el que pongas en `META_WEBHOOK_VERIFY_TOKEN`
   - Webhook fields: `messages`, `message_deliveries`, `message_reads`

   **Instagram (cubre Messenger + IG):**
   - Callback URL: `https://wechat-eight-sigma.vercel.app/api/webhooks/instagram`
   - Verify Token: el mismo de arriba
   - Webhook fields: `messages`, `messaging_postbacks`

---

## 🔐 Actualizar .env.local y Vercel

Una vez que tengas el nuevo `App ID`, `App Secret` y `config_id`, actualiza las env vars:

### .env.local (reemplaza los valores):

```bash
# === Meta (cambia el App ID y App Secret) ===
META_APP_ID=<nuevo-app-id>
META_APP_SECRET=<nuevo-app-secret>
NEXT_PUBLIC_META_APP_ID=<nuevo-app-id>
NEXT_PUBLIC_META_CONFIG_ID=<nuevo-config-id>
```

### Vercel Dashboard:

Ve a tu proyecto en [vercel.com](https://vercel.com) → **Settings** → **Environment Variables** y actualiza las mismas 4 variables. **Después haz un Redeploy** o push un commit vacío.

---

## ✅ Cómo verificar que todo está bien

1. Pega tu nuevo token en Wechat → /settings/channels → 🔑 Actualizar token
2. Refresca el panel de diagnóstico. Deberías ver:
   - ✅ Token válido. System User: admin (ID: 61592458953927) ← **ESTE ID, no el otro**
   - ✅ pages_show_list
   - ✅ business_management
   - ✅ pages_messaging
   - ✅ instagram_basic
   - ✅ whatsapp_business_management
   - ✅ instagram_manage_messages
   - ✅ whatsapp_business_messaging
   - ✅ Páginas de Facebook: "PM Solution"
   - ✅ WhatsApp Business Accounts: "PMSolution" +504 3333-0274
3. Click 🔗 Re-suscribir webhooks → debería salir ✅

---

## 🚨 Errores comunes

| Error | Causa | Solución |
|---|---|---|
| "Object does not exist" al suscribir | Token del System User equivocado | Usa el de ID `61592458953927` |
| "Invalid redirect URI" en OAuth | No agregaste el URI a la config | Agrégalo en "Valid OAuth Redirect URIs" |
| "Permission denied" en webhook | App no está en el BM | Agrégala en business.facebook.com/settings/accounts |
| Test WABA en popup de ESU | System User sin acceso al WABA real | Agrégalo en System User → "Add Assets" → WhatsApp Accounts |
