/**
 * UTILIDADES PARA API DEL BANCO MC4 - PAGOS QR
 * Sistema de Tickets 365Soft
 */

import axios, { AxiosInstance } from 'axios';
import {
  BancoAuthRequest,
  BancoAuthResponse,
  BancoGenerarQrRequest,
  BancoGenerarQrResponse,
  BancoVerificarEstadoRequest,
  BancoVerificarEstadoResponse,
  BancoWebhookPayload,
  ConfigBancoQr
} from '../../modules/compras/types';

class BancoQrUtil {
  private axiosClient: AxiosInstance;
  private config: ConfigBancoQr;
  private tokenCache: { token: string; expiresAt: Date } | null = null;

  constructor() {
    // Configuración desde variables de entorno
    this.config = {
      apiUrl: process.env.BANCO_QR_API_URL || 'https://sip.mc4.com.bo:8443',
      apiKey: process.env.BANCO_QR_API_KEY || '2977cb47ecc0fd3a326bd0c0cf57d04becaa59c2f101c3f7',
      serviceKey: process.env.BANCO_QR_SERVICE_KEY || '939aa1fcf73a32a737d495a059104a9a60a707074bceef68',
      username: process.env.BANCO_QR_USERNAME || 'dev365',
      password: process.env.BANCO_QR_PASSWORD || '365Soft',
      timeout: parseInt(process.env.BANCO_QR_TIMEOUT || '30000')
    };

    // Cliente Axios configurado
    this.axiosClient = axios.create({
      baseURL: this.config.apiUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Generar token de autenticación con el banco
   */
  async generarToken(): Promise<string> {
    try {
      // Verificar si hay un token válido en cache
      if (this.tokenCache && this.tokenCache.expiresAt > new Date()) {
        return this.tokenCache.token;
      }

      const url = '/autenticacion/v1/generarToken';
      const headers = {
        'apikey': this.config.apiKey,
        'Content-Type': 'application/json'
      };

      const body: BancoAuthRequest = {
        password: this.config.password,
        username: this.config.username
      };

      const response = await this.axiosClient.post<BancoAuthResponse>(
        url,
        body,
        { headers }
      );

      if (response.data.codigo !== '0000') {
        throw new Error(`Error generando token: ${response.data.mensaje}`);
      }

      const token = response.data.objeto.token;

      // Cache del token (expira en 1 hora)
      this.tokenCache = {
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000)
      };

      return token;
    } catch (error: any) {
      console.error('Error en generarToken:', error.response?.data || error.message);
      throw new Error(`Error autenticando con banco: ${error.message}`);
    }
  }

  /**
   * Generar QR Dinámico
   */
  async generarQrDinamico(params: {
    alias: string;
    monto: number;
    detalleGlosa: string;
    fechaVencimiento: Date;
  }): Promise<BancoGenerarQrResponse> {
    try {
      const token = await this.generarToken();

      const url = '/api/v1/generaQr';
      const headers = {
        'apikeyServicio': this.config.serviceKey,
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      const body: BancoGenerarQrRequest = {
        alias: params.alias,
        callback: '000',  // Callback interno
        detalleGlosa: params.detalleGlosa,
        monto: params.monto,
        moneda: 'BOB',
        fechaVencimiento: this.formatearFecha(params.fechaVencimiento),
        tipoSolicitud: 'API',
        unicoUso: true
      };

      const response = await this.axiosClient.post<BancoGenerarQrResponse>(
        url,
        body,
        { headers }
      );

      return response.data;
    } catch (error: any) {
      console.error('Error en generarQrDinamico:', error.response?.data || error.message);
      throw new Error(`Error generando QR: ${error.message}`);
    }
  }

  /**
   * Verificar estado de transacción QR
   */
  async verificarEstadoQr(alias: string): Promise<BancoVerificarEstadoResponse> {
    try {
      const token = await this.generarToken();

      const url = '/api/v1/estadoTransaccion';
      const headers = {
        'apikeyServicio': this.config.serviceKey,
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      const body: BancoVerificarEstadoRequest = {
        alias
      };

      const response = await this.axiosClient.post<BancoVerificarEstadoResponse>(
        url,
        body,
        { headers }
      );

      return response.data;
    } catch (error: any) {
      console.error('Error en verificarEstadoQr:', error.response?.data || error.message);
      throw new Error(`Error verificando estado: ${error.message}`);
    }
  }

  /**
   * Procesar webhook del banco
   */
  procesarWebhook(payload: BancoWebhookPayload): {
    codigoRespuesta: string;
    mensajeRespuesta: string;
  } {
    // El banco envía notificaciones cuando un QR es pagado
    // Esta función procesa el payload y devuelve la respuesta esperada

    console.log('📬 Webhook recibido del banco:', payload);

    // Devolver respuesta esperada por el banco
    return {
      codigoRespuesta: '0000',
      mensajeRespuesta: 'Registro Exitoso'
    };
  }

  /**
   * Generar alias único para QR
   * Formato: QR365T{timestamp}{random}
   * Ejemplo: QR365T20250220153000123
   */
  generarAliasUnico(compraId: string): string {
    const timestamp = Date.now().toString().slice(-12); // Últimos 12 dígitos
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `QR365T${timestamp}${random}`;
  }

  /**
   * Formatear fecha al formato esperado por el banco: dd/mm/yyyy
   */
  private formatearFecha(fecha: Date): string {
    const dia = fecha.getDate().toString().padStart(2, '0');
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const anio = fecha.getFullYear();
    return `${dia}/${mes}/${anio}`;
  }

  /**
   * Calcular fecha de vencimiento (por defecto 1 día)
   */
  calcularFechaVencimiento(horas: number = 24): Date {
    return new Date(Date.now() + horas * 60 * 60 * 1000);
  }

  /**
   * Validar respuesta del banco
   */
  validarRespuestaBanco(response: BancoGenerarQrResponse | BancoVerificarEstadoResponse): boolean {
    return response.codigo === '0000';
  }

  /**
   * Limpiar cache de token (para pruebas o logout)
   */
  limpiarTokenCache(): void {
    this.tokenCache = null;
  }
}

// Singleton instance
export const bancoQrUtil = new BancoQrUtil();
export default bancoQrUtil;
