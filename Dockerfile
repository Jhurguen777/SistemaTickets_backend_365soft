# ---- Build stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# OpenSSL requerido por Prisma en Alpine
RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma

# Una sola descarga de dependencias (incluye devDeps para compilar)
RUN npm ci

# Generar cliente Prisma
RUN npx prisma generate

COPY . .

RUN npm run build

# ---- Production stage ----
FROM node:20-alpine AS production

WORKDIR /app

# OpenSSL y wget para healthcheck
RUN apk add --no-cache openssl wget

# Copiar node_modules del builder (ya descargados, sin tocar npm registry)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

# NOTA: devDependencies incluidas — necesarias para hot reload con ts-node/nodemon en desarrollo
# Para producción usa el target production-final (poda devDeps)

# Copiar el Prisma client generado y el build compilado
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist

EXPOSE 3000

# CMD por defecto para producción
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]

# ---- Production Final (VPS/CI) — sin devDependencies ----
FROM production AS production-final
RUN npm prune --omit=dev
