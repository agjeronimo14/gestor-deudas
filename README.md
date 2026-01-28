# Gestor de Deudas (Cloudflare Pages + Functions + D1)

## Variables/Secrets (MUY IMPORTANTE)

En Cloudflare Pages, ve a:

**Workers & Pages → gestor-deudas → Settings → Variables and Secrets**

En el selector de **Environment**, configura *al menos* esto en **Production** (y opcionalmente también en Preview):

- **DEBUG_KEY** (Type: **Secret**) → ejemplo: `alejandro123`
- **SETUP_KEY** (Type: **Secret**) → ejemplo: `Zuka123456`

> ⚠️ Si tu Dashboard muestra el aviso de que las variables se administran por `wrangler.toml`, entonces **las variables tipo Text del Dashboard NO llegan al runtime**. En ese caso, usa **Secret**.

**Después de cambiar variables/secrets, debes hacer un nuevo deploy** (por ejemplo: "Retry deployment" en Deployments, o un commit vacío y push).

## Endpoints de debug (requieren DEBUG_KEY)

### Ver entorno (sin datos sensibles)

```powershell
$debug="alejandro123"
Invoke-RestMethod -Method Get -Uri "https://gestor-deudas.pages.dev/api/debug/env" -Headers @{"X-Debug-Key"=$debug } | ConvertTo-Json -Depth 10
```

### Probar si el password coincide con el hash en D1

POST:
```powershell
$debug="alejandro123"
$body=@{ username="admin"; password="Admin123!" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "https://gestor-deudas.pages.dev/api/debug/auth-check" -Headers @{"X-Debug-Key"=$debug} -ContentType "application/json" -Body $body | ConvertTo-Json -Depth 10
```

GET (alternativa):
```powershell
$debug="alejandro123"
Invoke-RestMethod -Method Get -Uri "https://gestor-deudas.pages.dev/api/debug/auth-check?username=admin&password=Admin123!" -Headers @{"X-Debug-Key"=$debug} | ConvertTo-Json -Depth 10
```

## Seed del Admin inicial (requiere SETUP_KEY)

```powershell
$setup="Zuka123456"
$body=@{ username="admin"; password="Admin123!" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "https://gestor-deudas.pages.dev/api/setup/seed-admin" -Headers @{"X-Setup-Key"=$setup} -ContentType "application/json" -Body $body | ConvertTo-Json -Depth 10
```

Luego:
```powershell
$body=@{ username="admin"; password="Admin123!" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "https://gestor-deudas.pages.dev/api/auth/login" -ContentType "application/json" -Body $body -SessionVariable s
Invoke-RestMethod -Method Get -Uri "https://gestor-deudas.pages.dev/api/auth/me" -WebSession $s | ConvertTo-Json -Depth 10
```
