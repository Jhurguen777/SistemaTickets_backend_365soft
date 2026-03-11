# Soluciones Docker - Registro de Problemas Resueltos

Este documento registra los problemas que hemos resuelto durante la configuración Docker del proyecto y sus soluciones.

---

## Tabla de Contenidos

1. [Error: DATABASE_URL no encontrada](#1-error-database_url-no-encontrada)
2. [Configuración de pgAdmin](#2-configuración-de-pgadmin)
3. [Verificar conexión a PostgreSQL en Docker](#3-verificar-conexión-a-postgresql-en-docker)
4. [Error: Container name already in use](#4-error-container-name-already-in-use)
5. [Comandos útiles de PostgreSQL](#5-comandos-útiles-de-postgresql)

---

## 1. Error: DATABASE_URL no encontrada

### Problema

Al ejecutar `npm run db:migrate` aparecía este error:

```
Error: Prisma schema validation - (get-config wasm)
Error code: P1012
error: Environment variable not found: DATABASE_URL.
```

### Causa

El archivo `.env` no tenía la variable `DATABASE_URL` definida. En `docker-compose.yml` esta variable se construía dinámicamente solo dentro del contenedor Docker, pero para ejecutar migraciones localmente se necesita en el archivo `.env`.

### Solución

Agregar la variable `DATABASE_URL` al archivo `.env`:

```env
DATABASE_URL=postgresql://postgres:DBZ180419@127.0.0.1:5434/tickets365?schema=public
```

### Nota importante

La variable `DATABASE_URL` en `.env` apunta al puerto `5434` porque así está configurado en `docker-compose.yml`:

```yaml
ports:
  - "127.0.0.1:5434:5432"
```

Esto no causa conflictos porque en Docker Compose, las variables definidas en la sección `environment:` tienen prioridad sobre las de `.env`.

---

## 2. Configuración de pgAdmin

### Problema

No se podía conectar pgAdmin a PostgreSQL en Docker.

### Solución - pgAdmin en Docker (recomendado)

#### Paso 1: Agregar pgAdmin a docker-compose.yml

```yaml
pgadmin:
  image: dpage/pgadmin4
  container_name: tickets_pgadmin
  restart: unless-stopped
  environment:
    PGADMIN_DEFAULT_EMAIL: admin@admin.com
    PGADMIN_DEFAULT_PASSWORD: admin
  ports:
    - "5050:80"
  depends_on:
    - postgres
```

#### Paso 2: Acceder a pgAdmin

- URL: http://localhost:5050
- Email: admin@admin.com
- Password: admin

#### Paso 3: Registrar servidor PostgreSQL

1. Clic derecho en "Servers" → "Register" → "Server..."
2. Configurar:

| Campo | Valor |
|-------|-------|
| Name | tickets365 (o cualquier nombre) |
| Host name/address | `postgres` (nombre del servicio) |
| Port | `5432` (puerto interno del contenedor) |
| Maintenance database | `postgres` |
| Username | `postgres` |
| Password | `DBZ180419` |

### Solución - pgAdmin local instalado

Si prefieres usar pgAdmin instalado en tu máquina (fuera de Docker):

| Campo | Valor |
|-------|-------|
| Host name/address | `127.0.0.1` |
| Port | `5434` (puerto mapeado externamente) |
| Username | `postgres` |
| Password | `DBZ180419` |

---

## 3. Verificar conexión a PostgreSQL en Docker

### Verificar que PostgreSQL está corriendo

```bash
docker ps --filter "name=tickets_postgres"
```

Salida esperada:

```
NAMES              STATUS
tickets_postgres   Up X minutes (healthy)
```

### Ver tablas en la base de datos

```bash
docker exec tickets_postgres psql -U postgres -d tickets365 -c "\dt"
```

### Ver registros de una tabla

```bash
# Ver contenido de tabla usuarios
docker exec tickets_postgres psql -U postgres -d tickets365 -c "SELECT * FROM usuarios LIMIT 5;"

# Ver contenido de tabla eventos
docker exec tickets_postgres psql -U postgres -d tickets365 -c "SELECT id, titulo, fecha FROM eventos LIMIT 5;"
```

### Ver columnas de una tabla

```bash
docker exec tickets_postgres psql -U postgres -d tickets365 -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'eventos' ORDER BY ordinal_position;"
```

### Ver IP del contenedor PostgreSQL

```bash
docker inspect tickets_postgres --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'
```

### Ver gateway de Docker (para conectar desde pgAdmin local)

```bash
docker network inspect bridge --format '{{range .IPAM.Config}}{{.Gateway}}{{end}}'
```

---

## 4. Error: Container name already in use

### Problema

Al ejecutar `docker compose up --build` aparecía:

```
Error response from daemon: Conflict. The container name "/tickets_pgadmin" is already in use.
```

### Causa

Ya existía un contenedor con ese nombre (creado manualmente antes).

### Solución

Eliminar el contenedor existente:

```bash
docker stop tickets_pgadmin
docker rm tickets_pgadmin
```

Luego ejecutar nuevamente:

```bash
docker compose up --build
```

---

## 5. Comandos útiles de PostgreSQL

### Verificar si hay PostgreSQL local corriendo

```bash
tasklist /FI "IMAGENAME eq postgres.exe"
```

Si no devuelve nada, solo estás usando PostgreSQL en Docker.

### Entrar a la consola interactiva de PostgreSQL

```bash
docker exec -it tickets_postgres psql -U postgres -d tickets365
```

Luego puedes usar comandos SQL directamente.

### Comandos SQL útiles dentro de psql

```sql
-- Ver todas las tablas
\dt

-- Ver estructura de una tabla
\d nombre_tabla

-- Ver registros de una tabla
SELECT * FROM nombre_tabla LIMIT 10;

-- Salir
\q
```

---

## Ejecutar Seed y Scripts de Administrador

### Ejecutar seed completo

```bash
# Desde el directorio backend/
npx prisma db seed
```

Esto crea:
- 1 administrador principal (en tabla `AdminRol`)
- 4 usuarios de prueba
- 1 evento con 600 asientos
- 3 compras de ejemplo
- 1 asistencia
- 1 reembolso

### Ejecutar script para asignar contraseñas

```bash
# Desde el directorio backend/
npx ts-node scripts/setAdminPasswords.ts
```

Este script asigna contraseñas a usuarios con rol `ADMIN` en la tabla `usuarios`.

### Credenciales de prueba después del seed

#### Administrador (tabla `AdminRol`):

| Credencial | Valor |
|-----------|-------|
| Email | `administrador@gmail.com` |
| Password | `superadmin` |
| Rol | `SUPER_ADMIN` |

#### Usuarios de prueba (tabla `Usuario`):

| Email | Nombre |
|-------|--------|
| admin@inmobiliaria.com | Admin Principal |
| juan.perez@gmail.com | Juan Pérez |
| maria.garcia@gmail.com | María García |
| carlos.rodriguez@gmail.com | Carlos Rodríguez |

---

## Comandos rápidos de referencia

```bash
# Iniciar proyecto Docker
docker compose up --build

# Ejecutar migraciones Prisma
npx prisma migrate dev

# Ejecutar seed
npx prisma db seed

# Ver tablas en PostgreSQL
docker exec tickets_postgres psql -U postgres -d tickets365 -c "\dt"

# Ver contenedores corriendo
docker compose ps

# Ver logs
docker compose logs -f

# Detener servicios
docker compose down
```

---

## URLs de Acceso

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost |
| Backend API | http://localhost:3000 |
| pgAdmin | http://localhost:5050 |
| Prisma Studio | http://localhost:5555 |
