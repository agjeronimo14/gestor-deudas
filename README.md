# GESTOR DE DEUDAS (Cloudflare Pages + Functions + D1)

Sistema web nuevo y estable con roles simples:
- **OWNER**: crea y gestiona cuentas y movimientos.
- **VIEWER**: solo ve cuentas asignadas y puede **confirmar “RECIBIDO”** en abonos PENDIENTE.
- **ADMIN** (opcional): administra usuarios.

## 1) Requisitos
- Node.js 18+ (ideal 20+)
- Wrangler 3.x

Instalación:
```bash
npm install
```

## 2) Crear la base D1
1) Crear DB:
```bash
npx wrangler d1 create gestor_deudas_db
```

2) Copiar el `database_id` que te imprime el comando y pegarlo en `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "gestor_deudas_db"
database_id = "REEMPLAZA_CON_TU_DATABASE_ID"
```

## 3) Migraciones / tablas
Aplicar migraciones en local:
```bash
npm run d1:apply:local
```

Aplicar migraciones en remote (Cloudflare):
```bash
npm run d1:apply:remote
```

> Las migraciones están en `migrations/0001_init.sql`.

## 4) Crear usuario ADMIN inicial (seed)
Como el sistema empieza vacío, crea el primer admin manualmente.

1) Genera el hash de un password:
```bash
npm run hash -- "Admin123!"
```
Copia el output (algo como `v1:pbkdf2_sha256:...`).

2) Inserta el usuario en D1 remote:
```bash
npx wrangler d1 execute gestor_deudas_db --remote --command "INSERT INTO users (username, password_hash, role) VALUES ('admin', '<HASH_AQUI>', 'ADMIN');"
```

Para local (opcional):
```bash
npx wrangler d1 execute gestor_deudas_db --local --command "INSERT INTO users (username, password_hash, role) VALUES ('admin', '<HASH_AQUI>', 'ADMIN');"
```

## 5) Correr en local
```bash
npm run dev
```

Wrangler levantará Pages con Functions + D1 local. Abre la URL que te indique.

## 6) Deploy a Cloudflare Pages

### Opción A (rápida) – CLI
```bash
npm run deploy
```

### Opción B – GitHub + Pages (recomendado)
1) Sube el repo a GitHub.
2) En Cloudflare Pages, conecta el repositorio.
3) Build settings:
   - Framework preset: **None**
   - Build command: *(vacío)*
   - Output directory: **public**
4) En **Settings → Functions → D1 Database bindings** agrega:
   - Variable name: `DB`
   - Database: `gestor_deudas_db`
5) Deploy.

## 7) Endpoints principales
- Auth:
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`

- Accounts:
  - `GET /api/accounts`
  - `POST /api/accounts` (solo OWNER)
  - `PUT /api/accounts/:id` (solo OWNER)
  - `DELETE /api/accounts/:id` (soft delete)

- Transactions:
  - `GET /api/transactions?account_id=...`
  - `POST /api/transactions` (solo OWNER)
  - `POST /api/transactions/:id/confirm-receipt` (solo VIEWER asignado)

- Admin (solo ADMIN):
  - `GET /api/admin/users`
  - `POST /api/admin/users` (crea user y retorna temp_password)
  - `POST /api/admin/users/:id/reset-password`

## 8) Checklist de pruebas (OWNER + VIEWER)
1) Login como `admin`.
2) En Admin crea dos usuarios: `owner1`, `viewer1`.
3) Login como `owner1`.
4) Crear cuenta con viewer `viewer1`.
5) Registrar ABONO (queda PENDIENTE).
6) Logout y login como `viewer1`.
7) Entrar a la cuenta asignada y presionar **Confirmar recibido**.
8) Volver a `owner1` y validar que el abono quedó **RECIBIDO**.

## Notas de estabilidad
- Respuestas API consistentes: `{ ok:true, data }` / `{ ok:false, error }`.
- Validaciones estrictas en confirmación de RECIBIDO.
- Logs con `reqId` para rastrear errores.
- Cookies HttpOnly, con `Secure` automático en HTTPS.
