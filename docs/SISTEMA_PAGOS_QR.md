# 🎫 SISTEMA DE PAGOS QR - DOCUMENTACIÓN COMPLETA

## 📋 Tabla de Contenidos
1. [Introducción](#introducción)
2. [Arquitectura](#arquitectura)
3. [Flujo de Pago](#flujo-de-pago)
4. [API Endpoints](#api-endpoints)
5. [Modelos de Datos](#modelos-de-datos)
6. [Configuración](#configuración)
7. [Ejemplos de Uso](#ejemplos-de-uso)
8. [Errores y Soluciones](#errores-y-soluciones)

---

## 🚀 INTRODUCCIÓN

El **Sistema de Pagos QR** permite a los usuarios pagar sus tickets usando aplicaciones bancarias como:
- Yape
- Tigo Money
- BCP Mobile
- Banco Mercantil Santa Cruz
- Otros bancos bolivianos

### Características Principales:
- ✅ Pagos en tiempo real
- ✅ QR dinámico (generado por el banco)
- ✅ Webhook para notificaciones instantáneas
- ✅ Polling para verificación de estado
- ✅ Limpieza automática de QRs vencidos
- ✅ Estados sincronizados (Banco ↔ Base de Datos)

---

## 🏗️ ARQUITECTURA

```
┌─────────────────────────────────────────────────────────────────┐
│                    ARQUITECTURA DE PAGOS QR                     │
└─────────────────────────────────────────────────────────────────┘

Frontend (React)                Backend (Express)                Banco MC4
     │                              │                                │
     │  1. Selecciona asiento        │                                │
     ├─────────────────────────────>│                                │
     │                              │                                │
     │  2. Inicia pago               │                                │
     ├─────────────────────────────>│                                │
     │                              │  3. Generar token               │
     │                              ├───────────────────────────────>│
     │                              │  4. Token                       │
     │                              │<───────────────────────────────┤
     │                              │                                │
     │                              │  5. Generar QR                  │
     │                              ├───────────────────────────────>│
     │                              │  6. QR generado (base64)        │
     │                              │<───────────────────────────────┤
     │                              │                                │
     │  7. QR + Countdown            │                                │
     │<─────────────────────────────┤                                │
     │                              │                                │
     │  8. Usuario escanea QR        │                                │
     │                              │                                │
     │                              │                                │
     │  9. Polling: Verificar estado │                                │
     │  (cada 10 seg)               │                                │
     ├─────────────────────────────>│                                │
     │                              │  10. Verificar estado           │
     │                              ├───────────────────────────────>│
     │                              │  11. Estado: PENDIENTE          │
     │                              │<───────────────────────────────┤
     │  12. Sigue pendiente          │                                │
     │<─────────────────────────────┤                                │
     │                              │                                │
     │                              │  13. Webhook: ¡PAGADO!           │
     │                              │<───────────────────────────────┤
     │                              │  14. Procesar pago               │
     │                              │  - Actualizar BD                 │
     │                              │  - Asiento → VENDIDO             │
     │                              │                                │
     │  15. Polling: Verificar estado │                                │
     ├─────────────────────────────>│                                │
     │                              │  16. Estado: PAGADO ✅           │
     │  17. ¡Pago completado!         │                                │
     │<─────────────────────────────┤                                │
```

---

## 🔄 FLUJO DE PAGO COMPLETO

### Paso 1: Usuario selecciona asiento

```typescript
// Frontend → Backend
POST /api/compras/iniciar-pago
{
  "asientoId": "uuid-asiento-123",
  "eventoId": "uuid-evento-456"
}

// Backend → Frontend
{
  "success": true,
  "message": "Pago iniciado correctamente",
  "compra": {
    "id": "uuid-compra-789",
    "monto": 100.00,
    "estadoPago": "PENDIENTE"
  }
}
```

### Paso 2: Backend genera QR del banco

```typescript
// Backend crea registro en QrPagos
{
  "alias": "QR365T1738084800123",
  "estado": "PENDIENTE",
  "monto": 100.00,
  "fechaVencimiento": "2025-02-21T15:30:00Z",
  "imagenQr": "data:image/png;base64,iVBORw0KGgoAAAANS..."
}

// Backend actualiza asiento a RESERVANDO
```

### Paso 3: Frontend muestra QR

```typescript
// Frontend muestra:
- QR del banco (imagen base64)
- Monto a pagar: 100 BOB
- Countdown: 24:00:00
- Instrucciones: "Escanea con tu app bancaria"
- Botón: "Verificar estado" (polling cada 10 seg)
```

### Paso 4: Usuario paga con app bancaria

```
Usuario → App Bancaria → Banco MC4
1. Usuario escanea QR
2. App muestra datos del pago
3. Usuario confirma
4. App procesa pago
5. Banco MC4 registra transacción
```

### Paso 5: Banco notifica al backend (Webhook)

```typescript
// Banco MC4 → Backend
POST /api/compras/webhook-qr
{
  "alias": "QR365T1738084800123",
  "estado": "PAGADO",
  "monto": 100.00,
  "numeroOrdenOriginante": "123456789",
  "nombreCliente": "Juan Pérez",
  "documentoCliente": "1234567"
}

// Backend procesa:
1. Actualiza QrPagos.estado = "PAGADO"
2. Actualiza Compra.estadoPago = "PAGADO"
3. Actualiza Asiento.estado = "VENDIDO"
4. Libera lock de Redis
```

### Paso 6: Frontend verifica estado (Polling)

```typescript
// Frontend → Backend (cada 10 segundos)
GET /api/compras/verificar-pago/{qrId}

// Backend → Frontend
{
  "success": true,
  "message": "¡Pago detectado y procesado exitosamente!",
  "qr": {
    "estado": "PAGADO",
    "monto": 100.00
  },
  "pagoProcesado": true
}

// Frontend:
- Detiene polling
- Muestra pantalla de éxito
- Redirige a Mis Compras
- Muestra QR de entrada
```

---

## 📡 API ENDPOINTS

### 1. Iniciar Pago

```http
POST /api/compras/iniciar-pago
Authorization: Bearer {token}

Request Body:
{
  "asientoId": "uuid-asiento-123",
  "eventoId": "uuid-evento-456"
}

Response (201 Created):
{
  "success": true,
  "message": "Pago iniciado correctamente",
  "compra": {
    "id": "uuid-compra-789",
    "usuarioId": "uuid-usuario-1",
    "eventoId": "uuid-evento-456",
    "asientoId": "uuid-asiento-123",
    "monto": 100.00,
    "moneda": "USD",
    "estadoPago": "PENDIENTE",
    "qrCode": "TICKET|uuid-asiento-123|1738084800123|4567",
    "createdAt": "2025-02-20T15:30:00Z"
  }
}
```

### 2. Obtener QR

```http
GET /api/compras/qr/{qrId}
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "data": {
    "id": "uuid-qr-123",
    "alias": "QR365T1738084800123",
    "estado": "PENDIENTE",
    "monto": 100.00,
    "moneda": "BOB",
    "fechaVencimiento": "2025-02-21T15:30:00Z",
    "imagenQr": "data:image/png;base64,iVBORw0KGgoAAAANS...",
    "detalleGlosa": "Ticket Evento: Conferencia 2025 - Asiento: A5"
  }
}
```

### 3. Verificar Estado de Pago

```http
GET /api/compras/verificar-pago/{qrId}
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "message": "Estado verificado: PENDIENTE",
  "qr": {
    "id": "uuid-qr-123",
    "alias": "QR365T1738084800123",
    "estado": "PENDIENTE",
    "monto": 100.00,
    "moneda": "BOB",
    "fechaVencimiento": "2025-02-21T15:30:00Z"
  },
  "estadoTransaccion": {
    "alias": "QR365T1738084800123",
    "estadoActual": "PENDIENTE",
    "monto": 100.00,
    "moneda": "BOB"
  },
  "pagoProcesado": false
}
```

### 4. Mis Compras

```http
GET /api/compras/mis-compras?page=1&limit=10
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "data": [
    {
      "id": "uuid-compra-789",
      "monto": 100.00,
      "moneda": "USD",
      "estadoPago": "PAGADO",
      "metodoPago": "QR BANCO",
      "qrCode": "TICKET|uuid-asiento-123|1738084800123|4567",
      "createdAt": "2025-02-20T15:30:00Z",
      "evento": {
        "id": "uuid-evento-456",
        "titulo": "Conferencia 2025",
        "fecha": "2025-03-15T00:00:00Z",
        "hora": "19:00",
        "ubicacion": "La Paz, Bolivia"
      },
      "asiento": {
        "id": "uuid-asiento-123",
        "fila": "A",
        "numero": 5
      },
      "qrPago": {
        "id": "uuid-qr-123",
        "alias": "QR365T1738084800123",
        "estado": "PAGADO",
        "imagenQr": null
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "totalPages": 1
  }
}
```

### 5. Cancelar QR

```http
POST /api/compras/cancelar-qr/{qrId}
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "message": "QR cancelado exitosamente"
}
```

### 6. Webhook del Banco

```http
POST /api/compras/webhook-qr
(No requiere autenticación - El banco envía notificaciones)

Request Body:
{
  "alias": "QR365T1738084800123",
  "numeroOrdenOriginante": "123456789",
  "monto": 100.00,
  "moneda": "BOB",
  "fechaproceso": "20/02/2025",
  "cuentaCliente": "12345678",
  "nombreCliente": "Juan Pérez",
  "documentoCliente": "1234567"
}

Response (200 OK):
{
  "codigo": "0000",
  "mensaje": "Registro Exitoso"
}
```

### 7. Limpiar QRs Vencidos (Cron Job)

```http
POST /api/compras/limpiar-vencidos
Authorization: Bearer {token}
X-Internal-Cron: true

Response (200 OK):
{
  "success": true,
  "message": "Limpieza de QRs vencidos completada"
}
```

---

## 💾 MODELOS DE DATOS

### QrPagos

```typescript
{
  id: string                    // UUID
  alias: string                 // QR365T1738084800123 (único)
  estado: EstadoQr              // PENDIENTE | PAGADO | CANCELADO | VENCIDO
  monto: number                 // Monto en BOB
  moneda: string                // "BOB"
  compraId?: string             // FK a Compra (cuando se paga)
  fechaVencimiento: Date        // 24 horas después de creado
  imagenQr?: string             // QR en base64
  detalleGlosa?: string         // Descripción del pago
  numeroOrden?: string          // Orden del banco
  nombreCliente?: string        // Cliente que pagó
  documentoCliente?: string     // CI del cliente
  cuentaCliente?: string        // Cuenta bancaria
  fechaproceso?: Date           // Fecha de procesamiento
  createdAt: Date
  updatedAt: Date
}
```

### Compra (Campos relacionados con QR)

```typescript
{
  // ... otros campos ...

  qrPagoId?: string             // FK a QrPagos
  qrPagoAlias?: string          // Alias del QR (para referencia rápida)
  qrCode: string                // QR de entrada (diferente al QR de pago)
  metodoPago?: string           // "QR BANCO" (cuando se paga)

  // ... otros campos ...
}
```

---

## ⚙️ CONFIGURACIÓN

### Variables de Entorno

```env
# Banco MC4 - Pagos QR
BANCO_QR_API_URL=https://sip.mc4.com.bo:8443
BANCO_QR_API_KEY=2977cb47ecc0fd3a326bd0c0cf57d04becaa59c2f101c3f7
BANCO_QR_SERVICE_KEY=939aa1fcf73a32a737d495a059104a9a60a707074bceef68
BANCO_QR_USERNAME=dev365
BANCO_QR_PASSWORD=365Soft
BANCO_QR_TIMEOUT=30000
```

### Cron Job (Limpieza de QRs vencidos)

```javascript
// Ejecutar cada hora
const cron = require('node-cron');

cron.schedule('0 * * * *', async () => {
  console.log('🧹 Iniciando limpieza de QRs vencidos...');

  try {
    const response = await axios.post(
      'http://localhost:3000/api/compras/limpiar-vencidos',
      {},
      {
        headers: {
          'Authorization': `Bearer ${ADMIN_TOKEN}`,
          'X-Internal-Cron': 'true'
        }
      }
    );

    console.log('✅ Limpieza completada:', response.data);
  } catch (error) {
    console.error('❌ Error en limpieza:', error);
  }
});
```

---

## 💡 EJEMPLOS DE USO

### Ejemplo 1: Flujo Completo en Frontend

```typescript
// 1. Iniciar pago
const response = await axios.post('/api/compras/iniciar-pago', {
  asientoId: 'uuid-asiento-123',
  eventoId: 'uuid-evento-456'
}, {
  headers: { Authorization: `Bearer ${token}` }
});

const { compra } = response.data;

// 2. Obtener QR
const qrResponse = await axios.get(`/api/compras/qr/${compra.id}`, {
  headers: { Authorization: `Bearer ${token}` }
});

const { imagenQr, alias, monto, fechaVencimiento } = qrResponse.data.data;

// 3. Mostrar QR al usuario
showPaymentModal({
  qrImage: imagenQr,
  amount: monto,
  expiresAt: fechaVencimiento,
  instructions: 'Escanea con Yape, Tigo Money o tu app bancaria'
});

// 4. Iniciar polling
const pollInterval = setInterval(async () => {
  const checkResponse = await axios.get(`/api/compras/verificar-pago/${compra.id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (checkResponse.data.pagoProcesado) {
    clearInterval(pollInterval);
    showSuccessScreen();
    redirectTo('/mis-compras');
  }
}, 10000); // Cada 10 segundos
```

### Ejemplo 2: Verificación Manual

```typescript
// Usuario hace clic en "Verificar estado"
const handleCheckStatus = async (qrId: string) => {
  try {
    const response = await axios.get(`/api/compras/verificar-pago/${qrId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const { qr, pagoProcesado } = response.data;

    if (pagoProcesado) {
      toast.success('¡Pago completado!');
      navigate('/mis-compras');
    } else {
      toast.info(`Estado: ${qr.estado}`);
    }
  } catch (error) {
    toast.error('Error verificando estado');
  }
};
```

---

## ❌ ERRORES Y SOLUCIONES

### Error 1: "QR no encontrado"

**Causa:** El QR no existe en la base de datos

**Solución:**
- Verificar que el QR ID sea correcto
- Verificar que la compra haya sido creada correctamente

### Error 2: "No autorizado"

**Causa:** El usuario no es dueño del QR

**Solución:**
- Verificar que el usuario esté autenticado
- Verificar que el QR pertenezca al usuario

### Error 3: "Error generando QR con el banco"

**Causa:** El banco MC4 no está disponible o rechazó la solicitud

**Solución:**
- Verificar conexión con el banco
- Verificar credenciales (API KEY, SERVICE KEY)
- Verificar que el monto sea válido

### Error 4: "QR vencido"

**Causa:** El QR expiró (24 horas)

**Solución:**
- Usuario debe iniciar un nuevo pago
- Implementar cron job para limpieza automática

### Error 5: "Asiento no disponible"

**Causa:** El asiento fue comprado por otro usuario

**Solución:**
- Usuario debe seleccionar otro asiento
- Implementar locks de Redis para prevenir esto

---

## 📊 ESTADÍSTICAS Y MONITOREO

### Métricas importantes

- **Tasa de conversión:** Compras iniciadas vs. pagadas
- **Tiempo promedio de pago:** Desde inicio hasta confirmación
- **QRs vencidos:** Porcentaje de QRs que expiran sin pago
- **Errores de banco:** Tasa de fallos en comunicación con el banco

### Logs importantes

```typescript
// Crear pago
console.log(`✅ Pago iniciado: ${compra.id} - QR: ${qr.alias}`);

// Pago completado
console.log(`💰 Pago procesado: QR ${qr.alias} - Monto: ${qr.monto}`);

// Webhook recibido
console.log(`📬 Webhook: ${payload.alias} - Estado: ${payload.estado}`);

// Error
console.error(`❌ Error: ${error.message} - Code: ${error.code}`);
```

---

**Última actualización:** 20 de Febrero, 2026
**Versión:** 1.0 - Sistema de Pagos QR completo
