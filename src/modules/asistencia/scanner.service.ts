// scanner.service.ts
// Responsabilidad: decodificar y validar la estructura del QR
// NO hace llamadas a la base de datos (eso es responsabilidad de AsistenciaService)

interface DatosQR {
  compraId: string;
  eventoId: string;
  version: string;
}

export class ScannerService {
  /**
   * Decodifica el string del QR y valida que tenga la estructura esperada.
   *
   * Formato del QR: JSON stringificado y codificado en base64
   * Ejemplo del payload:
   *   { "compraId": "uuid", "eventoId": "uuid", "version": "1" }
   *
   * @returns DatosQR si es válido, null si el formato es incorrecto
   */
  decodificarQR(qrCode: string): DatosQR | null {
    try {
      // Decodificar base64 → string JSON → objeto
      const decodificado = Buffer.from(qrCode, "base64").toString("utf-8");
      const datos = JSON.parse(decodificado) as Partial<DatosQR>;

      // Validar campos requeridos
      if (!datos.compraId || !datos.eventoId || !datos.version) {
        return null;
      }

      // Validar formato UUID básico
      const esUUID = (str: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

      if (!esUUID(datos.compraId) || !esUUID(datos.eventoId)) {
        return null;
      }

      return {
        compraId: datos.compraId,
        eventoId: datos.eventoId,
        version: datos.version,
      };
    } catch {
      // JSON malformado o base64 inválido
      return null;
    }
  }

  /**
   * Genera el contenido del QR para una compra.
   * Se usa desde el módulo de Compras al momento de generar el QR.
   *
   * @returns string base64 listo para pasarle a la librería qrcode
   */
  generarPayloadQR(compraId: string, eventoId: string): string {
    const payload: DatosQR = {
      compraId,
      eventoId,
      version: "1",
    };
    return Buffer.from(JSON.stringify(payload)).toString("base64");
  }
}