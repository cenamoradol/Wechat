# Setup de Meta (Facebook) para Wechat

Guía completa para configurar la app de Meta para usar con Wechat.

> ⚠️ **ACTUALIZADO 2026**: El nuevo flujo de creación de apps de Meta usa **"Casos de uso"** (use cases) en vez del antiguo selector de "tipo de app" (Business/Consumer). Esta guía refleja el flujo actual.

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

## 🛠 Paso a paso para recrear la app (flujo 2026)

### Paso 1: Detalles de la app

1. Ve a [developers.facebook.com](https://developers.facebook.com)
2. Click **"Mis Apps"** → **"Crear app"**
3. **Nombre de la app**: `Wechat` (o el que prefieras)
4. **Email de contacto**: tu email
5. Click **"Siguiente"** (o "Next")

### Paso 2: Casos de uso (USE CASES)

**Esta es la pantalla clave del nuevo flujo.** Verás una lista de casos de uso predefinidos. **Marca SOLO estos 2:**

- ✅ **"Conectarte con los clientes a través de WhatsApp"** ← CRÍTICO
  - Esto añade WhatsApp + Messenger + Instagram automáticamente
  - Permisos por defecto: `public_profile`, `whatsapp_business_management`, `whatsapp_business_messaging`

- ✅ **"Autenticar y solicitar datos a usuarios con el inicio de sesión con Facebook"** (opcional pero recomendado)
  - Esto añade Facebook Login, necesario para el OAuth que usamos en el tab "FB + IG (legacy)" de Wechat
  - Añade `email`, `public_profile`

**NO necesitas** los otros casos (anuncios, threads, juegos) — son para otros tipos de apps.

> ⚠️ Si la lista de casos de uso no muestra WhatsApp, asegúrate de que tu Business Manager "Buho Digital" existe y tienes al menos una página de Facebook. Sin eso, Meta no te muestra el caso de uso de WhatsApp.

Click **"Siguiente"**.

### Paso 3: Negocio (Business Manager)

1. Selecciona **"Buho Digital"** como Business Manager
2. Click **"Siguiente"**

> ⚠️ Si "Buho Digital" no aparece, necesitas crearlo primero en [business.facebook.com/create](https://business.facebook.com/create)

### Paso 4: Requisitos

Meta te mostrará una checklist de cosas a hacer. **Las más importantes:**

- [ ] Verificar tu Business Manager (si no lo está)
- [ ] Agregar un método de pago (para WhatsApp en producción, en dev no es necesario)
- [ ] Verificar tu dominio (opcional para dev)

Click "Siguiente" cuando esté listo (o sáltalo para terminar rápido).

### Paso 5: Resumen

Meta te muestra un resumen. Click **"Crear app"**.

**¡Listo!** Tu app está creada.

---

## 📝 Guarda estos valores

Cuando entres al dashboard de la app, **apunta**:

- **App ID** (número en la parte superior, ej. `987654321098765`) ← **MUY IMPORTANTE**
- **App Secret** (Settings → Basic → "Show" → copia) ← **MUY IMPORTANTE**

---

## ⚙️ Configurar productos y webhooks (DESPUÉS de crear la app)

### 1. Verificar que WhatsApp + Messenger + Instagram están añadidos

1. En el dashboard de tu app → **"Add Product"** (si no se añadieron por el caso de uso)
2. Añade cualquier producto faltante:
   - **WhatsApp**
   - **Messenger**
   - **Instagram**

### 2. Configurar WhatsApp (vía Meta, no en Wechat)

1. Sidebar → **WhatsApp → API Setup**
2. Verás tu **Phone Number ID** y **WABA ID** — estos ya los tienes:
   - Phone Number ID: `1276692908855446`
   - WABA ID: `2017363685552310`
3. **NO uses el token temporal** que aparece aquí — usa el del System User (siguiente paso)

### 3. Crear Embedded Signup Config (para OAuth)

1. Sidebar → busca **"Embedded Signup"** o "Facebook Login for Business → Configurations"
2. Click **"Create from template"** o "Create configuration"
3. Nombre: "Wechat OAuth"
4. Productos: **WhatsApp + Messenger + Instagram**
5. Permisos (marca los 7):
   ```
   ✅ business_management
   ✅ pages_show_list
   ✅ pages_messaging
   ✅ instagram_basic
   ✅ instagram_manage_messages
   ✅ whatsapp_business_management
   ✅ whatsapp_business_messaging
   ```
6. **Valid OAuth Redirect URIs**:
   - `http://localhost:3000/api/oauth/meta/callback`
   - `https://wechat-eight-sigma.vercel.app/api/oauth/meta/callback`
7. **Copia el `config_id`** generado ← **MUY IMPORTANTE**

### 4. Vincular app al Business Manager "Buho Digital"

1. Ve a [business.facebook.com/settings/accounts](https://business.facebook.com/settings/accounts)
2. Click **"Apps"** → **"Add"**
3. Busca tu nueva app por nombre
4. Click **"Add"**

### 5. Asignar System User correcto a la app

1. [business.facebook.com/settings/users](https://business.facebook.com/settings/users)
2. Click en **System User "admin" con ID `61592458953927`** (verifica el ID antes de continuar)
3. Sección **"Apps"** → **"Add Apps"** → selecciona tu nueva app
4. **Full Control** → Save
5. Verifica que la app aparece listada

### 6. Generar System User Token

1. Sigue en el System User `61592458953927`
2. **"Generate New Token"**
3. **App**: tu nueva app "Wechat"
4. Marca los **7 scopes** (mismos que en paso 3)
5. Expiración: "Never" (o lo más largo)
6. **Generate Token** → copia el `EAAxxxxx...` LARGO

⚠️ **CRÍTICO**: Verifica que generas el token desde el System User `61592458953927`, NO desde otro. Si el ID es diferente, estás en el equivocado.

### 7. Configurar webhook (DESPUÉS de deploy a Vercel)

Una vez Vercel esté actualizado, los webhooks se suscriben desde Wechat. Si lo quieres hacer manual:

1. [developers.facebook.com](https://developers.facebook.com) → tu app
2. Sidebar → **Webhooks** (depende de la app, puede estar en "Products → WhatsApp → Configuration")

**Para WhatsApp:**
- Callback URL: `https://wechat-eight-sigma.vercel.app/api/webhooks/whatsapp`
- Verify Token: tu `META_WEBHOOK_VERIFY_TOKEN`
- Fields: `messages`, `message_deliveries`, `message_reads`

**Para Instagram (cubre FB + IG):**
- Callback URL: `https://wechat-eight-sigma.vercel.app/api/webhooks/instagram`
- Verify Token: el mismo
- Fields: `messages`, `messaging_postbacks`

---

## 🔐 Actualizar env vars (DESPUÉS de tener todo)

### `.env.local` (reemplaza los valores):

```bash
# === Meta (CAMBIA ESTOS 4) ===
META_APP_ID=<nuevo-app-id>
META_APP_SECRET=<nuevo-app-secret>
NEXT_PUBLIC_META_APP_ID=<nuevo-app-id>
NEXT_PUBLIC_META_CONFIG_ID=<nuevo-config-id>
```

### Vercel:

Ve a tu proyecto en [vercel.com](https://vercel.com) → **Settings** → **Environment Variables** y actualiza las mismas 4 variables. **Después haz Redeploy**.

---

## ✅ Cómo verificar que todo está bien

1. Pega tu nuevo token en Wechat → /settings/channels → 🔑 Actualizar token
2. Refresca el panel de diagnóstico. **Verifica que diga `System User: admin (ID: 61592458953927)`**, no otro ID
3. Scopes esperados: ✅ los 7 + quizás public_profile
4. Páginas: ✅ "PM Solution"
5. Click 🔗 Re-suscribir webhooks → debería salir ✅

---

## 🚨 Errores comunes

| Síntoma | Causa | Solución |
|---|---|---|
| "No se muestran casos de uso de WhatsApp" | BM no configurado o sin páginas | Crea BM en business.facebook.com/create |
| "Object does not exist" al suscribir webhooks | Token de System User equivocado | Genera token desde `61592458953927` |
| "Invalid redirect URI" en OAuth | No agregaste el URI a la config | Agrégalo en "Valid OAuth Redirect URIs" |
| "App not in BM" | App no vinculada al Business Manager | Agrégala en business.facebook.com/settings/accounts |
| "Test WABA" en popup ESU | System User sin acceso a WABA real | Agrégalo en System User → Add Assets → WhatsApp Accounts |
