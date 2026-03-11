# Docker — Guía Completa del Sistema de Tickets

Esta documentación cubre todo lo relacionado con Docker en el proyecto: arranque, migraciones, seeds, flujos de desarrollo y resolución de problemas.

---

## Índice

1. [Arquitectura de servicios](#1-arquitectura-de-servicios)
2. [Estructura de archivos](#2-estructura-de-archivos)
3. [Variables de entorno (.env)](#3-variables-de-entorno-env)
4. [Primer arranque](#4-primer-arranque)
5. [Operaciones del día a día](#5-operaciones-del-día-a-día)
6. [Base de datos y Migraciones](#6-base-de-datos-y-migraciones)
7. [Seeds — Datos iniciales](#7-seeds--datos-iniciales)
8. [Actualizar el código (redeploy)](#8-actualizar-el-código-redeploy)
9. [Logs y depuración](#9-logs-y-depuración)
10. [Backups y restauración](#10-backups-y-restauración)
11. [Resetear completamente el entorno](#11-resetear-completamente-el-entorno)
12. [Referencia rápida de comandos](#12-referencia-rápida-de-comandos)

---

## 1. Arquitectura de servicios

```
┌─────────────────────────────────────────────────────────────┐
│  Internet / Navegador                                       │
└───────────────────────────┬─────────────────────────────────┘
                            │ :80
                    ┌───────▼────────┐
                    │   NGINX        │  tickets_frontend
                    │  (Frontend)    │  React + Vite → nginx
                    └──────┬────┬───┘
                    /api/  │    │ /socket.io/
                           │    │
                    ┌──────▼────▼───┐
                    │   Backend     │  tickets_backend
                    │  (Node.js)    │  Express + Socket.IO
                    │  :3000        │  (solo 127.0.0.1)
                    └───┬───────┬──┘
                        │       │
              ┌─────────▼─┐  ┌──▼────────┐
              │ PostgreSQL │  │   Redis   │
              │  :5432     │  │   :6379   │
              │ (127.0.0.1)│  │(127.0.0.1)│
              └────────────┘  └───────────┘
```

| Contenedor          | Imagen              | Puerto expuesto      | Descripción                              |
|---------------------|---------------------|----------------------|------------------------------------------|
| `tickets_postgres`  | postgres:16-alpine  | `127.0.0.1:5432`     | Base de datos principal                  |
| `tickets_redis`     | redis:7-alpine      | `127.0.0.1:6379`     | Cache de sesiones y locks de asientos    |
| `tickets_backend`   | Build local         | `127.0.0.1:3000`     | API REST + WebSocket                     |
| `tickets_frontend`  | Build local         | `0.0.0.0:80`         | SPA React servida por nginx              |

> **Nota de seguridad:** Postgres, Redis y el Backend solo escuchan en `127.0.0.1` (localhost). Solo el puerto 80 del Frontend es accesible desde la red externa.

---

## 2. Estructura de archivos

```
Proyecto-tickets/
├── SistemaTickets_backend_365soft/   ← Repo del backend (aquí se gestiona todo)
│   ├── docker-compose.yml            ← Orquesta TODOS los servicios
│   ├── Dockerfile                    ← Imagen del backend
│   ├── .env                          ← Variables de entorno (NO subir a git)
│   ├── .env.example                  ← Plantilla para nuevos desarrolladores
│   ├── prisma/
│   │   ├── schema.prisma             ← Modelo de datos
│   │   ├── migrations/               ← Historial de migraciones (en git)
│   │   └── seed.ts                   ← Datos iniciales (admin, etc.)
│   └── src/
│
└── SistemaTickets_365soft/           ← Repo del frontend
    ├── docker-compose.yml            ← Solo para desarrollo standalone del frontend
    ├── Dockerfile                    ← Imagen del frontend
    └── nginx.conf                    ← Proxy inverso a backend + SPA fallback
```

> **Regla:** Siempre ejecutar `docker compose` desde `SistemaTickets_backend_365soft/`. Ese `docker-compose.yml` es el único orquestador del stack completo.

---

## 3. Variables de entorno (.env)

El archivo `.env` dentro de `SistemaTickets_backend_365soft/` alimenta **todos** los servicios.

### Contenido mínimo requerido

```dotenv
# ── PostgreSQL ────────────────────────────────────────────────────
POSTGRES_USER=postgres
POSTGRES_PASSWORD=tu_password_seguro
POSTGRES_DB=tickets365

# ── Server ────────────────────────────────────────────────────────
PORT=3000
NODE_ENV=production

# ── URLs ──────────────────────────────────────────────────────────
FRONTEND_URL=http://localhost
CORS_ORIGIN=http://localhost,http://127.0.0.1

# ── JWT ───────────────────────────────────────────────────────────
JWT_SECRET=cadena_larga_aleatoria_minimo_32_chars
JWT_EXPIRES_IN=7d

# ── Redis ─────────────────────────────────────────────────────────
REDIS_URL=redis://redis:6379

# ── Google OAuth ──────────────────────────────────────────────────
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# ── Banco MC4 — Pagos QR ──────────────────────────────────────────
BANCO_QR_API_URL=https://sip.mc4.com.bo:8443
BANCO_QR_API_KEY=tu_api_key
BANCO_QR_SERVICE_KEY=tu_service_key
BANCO_QR_USERNAME=tu_usuario
BANCO_QR_PASSWORD=tu_password
BANCO_QR_TIMEOUT=30000

# ── Stripe (opcional) ─────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ── Resend / Email (opcional) ─────────────────────────────────────
RESEND_API_KEY=re_...
```

> **Importante:** El backend fallará al arrancar si falta cualquiera de: `JWT_SECRET`, `DATABASE_URL`, `REDIS_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `BANCO_QR_API_URL`, `BANCO_QR_API_KEY`, `BANCO_QR_SERVICE_KEY`, `BANCO_QR_USERNAME`, `BANCO_QR_PASSWORD`.
>
> `DATABASE_URL` es construida automáticamente por docker-compose a partir de las variables `POSTGRES_*`, no se debe definir manualmente en `.env`.

---

## 4. Primer arranque

### Paso 1 — Preparar el entorno

```bash
cd SistemaTickets_backend_365soft

# Copiar la plantilla y completar con valores reales
cp .env.example .env
nano .env   # o tu editor favorito
```

### Paso 2 — Construir y levantar

```bash
docker compose up --build -d
```

Esto:
1. Construye las imágenes de backend y frontend desde cero
2. Levanta PostgreSQL y Redis
3. Ejecuta automáticamente `prisma migrate deploy` dentro del backend
4. Inicia la API y el servidor nginx

### Paso 3 — Verificar que todo está sano

```bash
docker compose ps
```

Todos los servicios deben aparecer como `healthy` o `Up`:

```
NAME                STATUS
tickets_postgres    Up X minutes (healthy)
tickets_redis       Up X minutes (healthy)
tickets_backend     Up X minutes (healthy)
tickets_frontend    Up X minutes
```

### Paso 4 — Cargar datos iniciales (seed)

El seed crea el usuario administrador y los datos base. Se ejecuta **una sola vez** en el primer arranque:

```bash
DATABASE_URL="postgresql://postgres:TU_PASSWORD@127.0.0.1:5432/tickets365?schema=public" \
  npx tsx prisma/seed.ts
```

Reemplaza `TU_PASSWORD` con el valor de `POSTGRES_PASSWORD` en tu `.env`.

**Credenciales del administrador por defecto:**
- Email: `administrador@gmail.com`
- Password: `superadmin`

> **Cambiar la password inmediatamente** después del primer login desde el panel de administración.

### Paso 5 — Verificar acceso

```bash
# Health check del backend
curl http://localhost:3000/health

# La aplicación
open http://localhost       # Frontend
open http://localhost/admin # Panel de administración
```

---

## 5. Operaciones del día a día

### Iniciar todos los servicios

```bash
docker compose up -d
```

### Detener todos los servicios (datos preservados)

```bash
docker compose down
```

### Detener y eliminar volúmenes (PELIGRO: borra todos los datos)

```bash
docker compose down -v
```

### Ver estado de los contenedores

```bash
docker compose ps
```

### Reiniciar un servicio específico

```bash
docker compose restart backend
docker compose restart frontend
docker compose restart postgres
docker compose restart redis
```

### Aplicar cambios de código sin perder datos

```bash
# Backend
docker compose build backend && docker compose up -d backend

# Frontend
docker compose build frontend && docker compose up -d frontend

# Ambos a la vez
docker compose build backend frontend && docker compose up -d backend frontend
```

---

## 6. Base de datos y Migraciones

Las migraciones son la forma controlada de evolucionar el esquema de base de datos. **Siempre se deben versionar en git** (carpeta `prisma/migrations/`).

### Flujo de trabajo con migraciones

#### A) Crear una nueva migración (en desarrollo local)

> Requiere Node.js y las dependencias instaladas localmente, o usar un contenedor temporal.

```bash
# Con Node.js instalado localmente:
DATABASE_URL="postgresql://postgres:TU_PASSWORD@127.0.0.1:5432/tickets365?schema=public" \
  npx prisma migrate dev --name nombre_descriptivo_del_cambio
```

**Ejemplo:**
```bash
DATABASE_URL="postgresql://..." \
  npx prisma migrate dev --name add_campo_telefono_a_usuario
```

Esto:
1. Detecta los cambios en `prisma/schema.prisma`
2. Genera el archivo SQL en `prisma/migrations/TIMESTAMP_nombre/migration.sql`
3. Aplica la migración a la base de datos local
4. Regenera el cliente Prisma

> Después de crear la migración, **hacer commit** del archivo generado junto con los cambios en `schema.prisma`.

#### B) Aplicar migraciones pendientes en producción

Esto ocurre **automáticamente** cada vez que el backend arranca dentro de Docker:

```dockerfile
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
```

Si necesitas aplicarlas manualmente:

```bash
# Desde el host, apuntando al contenedor de postgres
DATABASE_URL="postgresql://postgres:TU_PASSWORD@127.0.0.1:5432/tickets365?schema=public" \
  npx prisma migrate deploy
```

O ejecutando dentro del contenedor del backend:

```bash
docker exec -it tickets_backend sh -c "npx prisma migrate deploy"
```

#### C) Ver el estado de las migraciones

```bash
DATABASE_URL="postgresql://postgres:TU_PASSWORD@127.0.0.1:5432/tickets365?schema=public" \
  npx prisma migrate status
```

Salida esperada cuando todo está al día:
```
All migrations have been applied.
```

#### D) Explorar la base de datos con Prisma Studio

Prisma Studio es una interfaz web para ver y editar datos directamente:

```bash
DATABASE_URL="postgresql://postgres:TU_PASSWORD@127.0.0.1:5432/tickets365?schema=public" \
  npx prisma studio
```

Abre `http://localhost:5555` en el navegador.

#### E) Conectarse a PostgreSQL directamente (psql)

```bash
# Desde el host
docker exec -it tickets_postgres psql -U postgres -d tickets365

# Comandos útiles dentro de psql:
\dt                     -- listar todas las tablas
\d nombre_tabla         -- estructura de una tabla
SELECT * FROM usuarios; -- consulta simple
\q                      -- salir
```

---

### Modificar el schema — ejemplo completo

**Escenario:** Agregar el campo `telefono` a la tabla de eventos.

**1. Editar `prisma/schema.prisma`:**
```prisma
model Evento {
  // ... campos existentes ...
  telefono  String?   // ← campo nuevo
}
```

**2. Crear la migración:**
```bash
DATABASE_URL="postgresql://postgres:TU_PASSWORD@127.0.0.1:5432/tickets365?schema=public" \
  npx prisma migrate dev --name add_telefono_to_evento
```

**3. Commit:**
```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add telefono field to Evento model"
```

**4. En producción (se aplica solo al hacer redeploy):**
```bash
docker compose build backend && docker compose up -d backend
```

---

## 7. Seeds — Datos iniciales

El seed (`prisma/seed.ts`) crea los datos base necesarios para que la aplicación funcione: el usuario administrador, roles, etc.

### Cuándo ejecutar el seed

- **Solo en el primer arranque** de un entorno nuevo
- Después de un `docker compose down -v` (que borra todos los datos)
- Al configurar un nuevo servidor/entorno

### Ejecutar el seed

```bash
DATABASE_URL="postgresql://postgres:TU_PASSWORD@127.0.0.1:5432/tickets365?schema=public" \
  npx tsx prisma/seed.ts
```

> El seed está diseñado para ser **idempotente** — si se ejecuta varias veces, no duplica datos (usa `upsert`).

### Verificar que el seed funcionó

```bash
docker exec -it tickets_postgres psql -U postgres -d tickets365 \
  -c "SELECT email, \"tipoRol\", estado FROM roles;"
```

Debe aparecer:
```
          email          |   tipoRol   | estado
-------------------------+-------------+--------
 administrador@gmail.com | SUPER_ADMIN | ACTIVO
```

---

## 8. Actualizar el código (redeploy)

### Actualización normal (pull + rebuild)

```bash
cd SistemaTickets_backend_365soft

# Traer cambios
git pull

# Si hay cambios en el frontend también:
cd ../SistemaTickets_365soft && git pull && cd ../SistemaTickets_backend_365soft

# Reconstruir y reiniciar (sin perder datos)
docker compose build --no-cache backend frontend
docker compose up -d backend frontend
```

> `--no-cache` fuerza la reconstrucción completa ignorando capas cacheadas. Útil cuando hay cambios en dependencias o variables de entorno.

### Solo backend cambió

```bash
docker compose build backend && docker compose up -d backend
```

### Solo frontend cambió

```bash
docker compose build frontend && docker compose up -d frontend
```

### Actualizaciones con nuevas migraciones

Cuando hay cambios en `prisma/schema.prisma` y nuevas migraciones:

```bash
# Las migraciones se aplican automáticamente al iniciar el backend
docker compose build backend && docker compose up -d backend

# Verificar que se aplicaron
docker logs tickets_backend | grep -E "migrat|error" -i
```

Salida esperada:
```
X migrations found in prisma/migrations
No pending migrations to apply.
```

---

## 9. Logs y depuración

### Ver logs en tiempo real

```bash
# Todos los servicios
docker compose logs -f

# Solo backend
docker compose logs -f backend

# Solo frontend (nginx)
docker compose logs -f frontend

# Solo PostgreSQL
docker compose logs -f postgres
```

### Ver las últimas N líneas

```bash
docker compose logs --tail=50 backend
docker compose logs --tail=100 postgres
```

### Entrar al contenedor del backend (shell interactivo)

```bash
docker exec -it tickets_backend sh
```

Desde ahí puedes:
```bash
ls dist/          # ver archivos compilados
node --version    # verificar versión de Node
npx prisma --version
```

### Verificar variables de entorno dentro del contenedor

```bash
docker exec tickets_backend printenv | grep -E "JWT|DATABASE|REDIS|GOOGLE" | sort
```

> Esto no muestra los valores de variables sensibles en logs, solo confirma que están presentes.

### Health check manual

```bash
curl -s http://localhost:3000/health | python3 -m json.tool
```

Respuesta esperada:
```json
{
  "status": "OK",
  "timestamp": "2026-03-10T...",
  "redis": "conectado",
  "uptime": 1234.5,
  "version": "1.0.0"
}
```

---

## 10. Backups y restauración

### Hacer backup de PostgreSQL

```bash
# Backup completo en formato custom (comprimido, restaurable selectivamente)
docker exec tickets_postgres pg_dump \
  -U postgres \
  -F c \
  -d tickets365 \
  > backup_$(date +%Y%m%d_%H%M%S).dump

# Backup en SQL plano (legible pero más grande)
docker exec tickets_postgres pg_dump \
  -U postgres \
  -d tickets365 \
  > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restaurar un backup

```bash
# Formato custom (.dump)
docker exec -i tickets_postgres pg_restore \
  -U postgres \
  -d tickets365 \
  --clean \
  < backup_20260310_120000.dump

# SQL plano (.sql)
docker exec -i tickets_postgres psql \
  -U postgres \
  -d tickets365 \
  < backup_20260310_120000.sql
```

### Backup automático — script recomendado

Crear `scripts/backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/backups/tickets"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

docker exec tickets_postgres pg_dump \
  -U postgres -F c -d tickets365 \
  > "$BACKUP_DIR/tickets_$DATE.dump"

# Borrar backups más viejos que RETENTION_DAYS días
find "$BACKUP_DIR" -name "*.dump" -mtime +$RETENTION_DAYS -delete

echo "Backup completado: tickets_$DATE.dump"
```

```bash
chmod +x scripts/backup.sh

# Ejecutar manualmente
./scripts/backup.sh

# O agregar al cron del sistema (backup diario a las 3am)
crontab -e
# 0 3 * * * /ruta/SistemaTickets_backend_365soft/scripts/backup.sh
```

---

## 11. Resetear completamente el entorno

> **PELIGRO:** Esto elimina **todos los datos** de la base de datos y Redis. Solo usar en desarrollo o cuando se quiere empezar desde cero.

```bash
# Detener todos los contenedores y eliminar volúmenes
docker compose down -v

# (Opcional) Eliminar imágenes también para forzar rebuild completo
docker compose down -v --rmi local

# Volver a construir desde cero
docker compose up --build -d

# Esperar que el backend esté healthy (~30 segundos)
docker compose ps

# Ejecutar seed
DATABASE_URL="postgresql://postgres:TU_PASSWORD@127.0.0.1:5432/tickets365?schema=public" \
  npx tsx prisma/seed.ts
```

---

## 12. Referencia rápida de comandos

### Stack completo

| Acción | Comando |
|--------|---------|
| Levantar todo | `docker compose up -d` |
| Levantar con rebuild | `docker compose up --build -d` |
| Detener (datos preservados) | `docker compose down` |
| Detener + borrar datos | `docker compose down -v` |
| Ver estado | `docker compose ps` |
| Ver logs en vivo | `docker compose logs -f` |

### Servicios individuales

| Acción | Comando |
|--------|---------|
| Rebuild + reiniciar backend | `docker compose build backend && docker compose up -d backend` |
| Rebuild + reiniciar frontend | `docker compose build frontend && docker compose up -d frontend` |
| Reiniciar sin rebuild | `docker compose restart backend` |
| Shell en backend | `docker exec -it tickets_backend sh` |
| Shell en postgres | `docker exec -it tickets_postgres psql -U postgres -d tickets365` |
| Logs backend (últimas 50) | `docker compose logs --tail=50 backend` |

### Base de datos

| Acción | Comando |
|--------|---------|
| Crear migración | `DATABASE_URL="..." npx prisma migrate dev --name nombre` |
| Aplicar migraciones | `DATABASE_URL="..." npx prisma migrate deploy` |
| Ver estado migraciones | `DATABASE_URL="..." npx prisma migrate status` |
| Abrir Prisma Studio | `DATABASE_URL="..." npx prisma studio` |
| Ejecutar seed | `DATABASE_URL="..." npx tsx prisma/seed.ts` |
| Backup | `docker exec tickets_postgres pg_dump -U postgres -F c -d tickets365 > backup.dump` |
| Restaurar | `docker exec -i tickets_postgres pg_restore -U postgres -d tickets365 --clean < backup.dump` |

### Troubleshooting rápido

| Síntoma | Solución |
|---------|----------|
| Backend `unhealthy` | `docker compose logs backend` para ver el error |
| Error de autenticación postgres | `docker compose down -v && docker compose up -d` (volumen con password viejo) |
| Frontend no conecta al API | Verificar que `VITE_API_URL=/api` en `.env` del frontend |
| Migraciones no se aplicaron | `docker exec tickets_backend npx prisma migrate deploy` |
| Redis no conecta | `docker compose restart redis` y esperar ~10s |
| Puerto 80 ocupado | `sudo lsof -i :80` para ver qué proceso lo usa |
| Cambios de código no reflejan | Hacer rebuild con `--no-cache`: `docker compose build --no-cache backend` |

---

## Notas importantes

### Google OAuth en local

El callback de Google OAuth está registrado como `http://localhost:3000/api/auth/google/callback`. Por eso el backend expone el puerto `3000` solo en `127.0.0.1` (no en la red externa). El flujo es:

```
Navegador → http://localhost/api/auth/google  (nginx proxy)
Google    → http://localhost:3000/api/auth/google/callback  (directo al backend)
Backend   → http://localhost/auth/success  (redirige al frontend)
```

### Variables de Vite (frontend)

Las variables `VITE_*` se **incrustan en tiempo de build**, no en tiempo de ejecución. Si cambias `VITE_API_URL` en `.env`, debes reconstruir el frontend:

```bash
docker compose build --no-cache frontend && docker compose up -d frontend
```

En producción Docker, `VITE_API_URL` debe ser `/api` (ruta relativa) para que nginx haga el proxy correctamente. **Nunca** usar `http://localhost:3000/api` en producción.

### El `DATABASE_URL` no va en `.env`

Es construida automáticamente por `docker-compose.yml` a partir de las variables `POSTGRES_*`:

```yaml
environment:
  DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public
```

Sin embargo, cuando se ejecutan comandos Prisma **desde el host** (fuera de Docker), se debe proporcionar manualmente porque el hostname `postgres` solo existe dentro de la red Docker. Por eso todos los comandos del host usan `127.0.0.1:5432` en su lugar.
