/**
 * TIPOS PARA SISTEMA DE PAGOS QR
 * Sistema de Tickets 365Soft - Banco MC4
 */

// ============================================
// REQUESTS
// ============================================

export interface IniciarPagoRequest {
  asientoId: string;
  eventoId: string;
  datosAsistente?: DatosAsistente;
}

export interface DatosAsistente {
  nombre: string;
  email: string;
  telefono: string;
}

export interface GenerarQrRequest {
  monto: number;
  compraId: string;
  detalleGlosa: string;
}

export interface VerificarPagoRequest {
  qrId?: string;
  alias?: string;
}

// ============================================
// RESPONSES
// ============================================

export interface IniciarPagoResponse {
  success: boolean;
  message: string;
  compra?: CompraCreada;
}

export interface CompraCreada {
  id: string;
  usuarioId: string;
  eventoId: string;
  asientoId: string;
  monto: number;
  moneda: string;
  estadoPago: string;
  qrCode: string;
  createdAt: Date;
}

export interface QrGeneradoResponse {
  success: boolean;
  message: string;
  qr?: QrInfo;
}

export interface QrInfo {
  id: string;
  alias: string;
  estado: string;
  monto: number;
  moneda: string;
  fechaVencimiento: Date;
  imagenQr?: string;
  detalleGlosa: string;
}

export interface VerificarPagoResponse {
  success: boolean;
  message: string;
  qr?: QrInfo;
  estadoTransaccion?: EstadoTransaccionBanco;
  pagoProcesado?: boolean;
}

// ============================================
// BANCO MC4 - TIPOS
// ============================================

export interface BancoAuthRequest {
  password: string;
  username: string;
}

export interface BancoAuthResponse {
  codigo: string;
  mensaje: string;
  objeto: {
    token: string;
    fechaExpiracion: string;
  };
}

export interface BancoGenerarQrRequest {
  alias: string;
  callback: string;
  detalleGlosa: string;
  monto: number;
  moneda: string;
  fechaVencimiento: string;
  tipoSolicitud: string;
  unicoUso: boolean;
}

export interface BancoGenerarQrResponse {
  codigo: string;
  mensaje: string;
  objeto?: {
    idQr: string;
    alias: string;
    imagenQr: string;  // Base64
    fechaVencimiento: string;
  };
}

export interface BancoVerificarEstadoRequest {
  alias: string;
}

export interface BancoVerificarEstadoResponse {
  codigo: string;
  mensaje: string;
  objeto: EstadoTransaccionBanco;
}

export interface EstadoTransaccionBanco {
  alias: string;
  estadoActual: string;  // PENDIENTE, PAGADO, CANCELADO, VENCIDO
  monto: number;
  moneda: string;
  numeroOrdenOriginante?: string;
  idQr?: string;
  fechaproceso?: string;
  cuentaCliente?: string;
  nombreCliente?: string;
  documentoCliente?: string;
}

export interface BancoWebhookPayload {
  alias: string;
  numeroOrdenOriginante?: string;
  monto?: number;
  idQr?: string;
  moneda?: string;
  fechaproceso?: string;
  cuentaCliente?: string;
  nombreCliente?: string;
  documentoCliente?: string;
}

// ============================================
// ESTADOS QR
// ============================================

export enum EstadoQr {
  PENDIENTE = 'PENDIENTE',
  PAGADO = 'PAGADO',
  CANCELADO = 'CANCELADO',
  VENCIDO = 'VENCIDO'
}

export enum EstadoPago {
  PENDIENTE = 'PENDIENTE',
  PAGADO = 'PAGADO',
  REEMBOLSADO = 'REEMBOLSADO',
  FALLIDO = 'FALLIDO'
}

// ============================================
// ERRORES
// ============================================

export interface ErrorResponse {
  success: false;
  message: string;
  error?: string;
  code?: string;
}

export class PagoQrError extends Error {
  constructor(
    public message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'PagoQrError';
  }
}

// ============================================
// UTILIDADES
// ============================================

export interface ConfigBancoQr {
  apiUrl: string;
  apiKey: string;
  serviceKey: string;
  username: string;
  password: string;
  timeout: number;
}

export interface QrPaginaOptions {
  page?: number;
  limit?: number;
  estado?: EstadoQr;
}

export interface CompraConDetalles {
  id: string;
  monto: number;
  moneda: string;
  estadoPago: string;
  metodoPago: string | null;
  qrPagoAlias: string | null;
  qrCode: string;
  createdAt: Date;
  evento: {
    id: string;
    titulo: string;
    fecha: Date;
    hora: string;
    ubicacion: string;
  };
  asiento: {
    id: string;
    fila: string;
    numero: number;
  };
  qrPago?: {
    id: string;
    alias: string;
    estado: string;
    imagenQr: string | null;
  };
}
