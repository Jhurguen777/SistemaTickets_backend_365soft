// src/shared/utils/email.util.ts
// Servicio de envío de emails usando Resend

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface ConfirmacionPagoData {
  email: string;
  nombre: string;
  eventoTitulo: string;
  eventoFecha: string;
  eventoUbicacion: string;
  monto: number;
  moneda?: string;
  compras: Array<{
    asiento: string; // e.g. "A1"
    qrCode: string;  // código QR de entrada al evento
  }>;
}

/**
 * Envía email de confirmación de compra al usuario.
 * No-bloqueante: nunca lanza excepciones hacia afuera.
 */
export async function enviarConfirmacionPago(data: ConfirmacionPagoData): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || apiKey === 're_tu_api_key' || apiKey.trim() === '') {
    console.warn('[Email] ⚠️  RESEND_API_KEY no configurado — email de confirmación omitido');
    return;
  }

  try {
    const moneda = data.moneda ?? 'Bs';

    const ticketsHtml = data.compras
      .map(
        (c, i) => `
      <tr style="background: ${i % 2 === 0 ? '#ffffff' : '#f9fafb'};">
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #1e3a5f;">
          Asiento ${c.asiento}
        </td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; font-family: monospace; font-size: 11px; color: #6b7280; word-break: break-all;">
          ${c.qrCode}
        </td>
      </tr>
    `
      )
      .join('');

    const { error } = await resend.emails.send({
      from: 'SistemaTickets 365Soft <no-reply@alfabolivia.com>',
      to: [data.email],
      subject: `✅ Confirmación de compra — ${data.eventoTitulo}`,
      html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmación de compra</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);max-width:600px;width:100%;">

          <!-- HEADER -->
          <tr>
            <td style="background:#1e3a5f;padding:36px 32px;text-align:center;">
              <h1 style="color:#ffffff;margin:0 0 8px 0;font-size:26px;font-weight:700;">
                ¡Compra confirmada! 🎉
              </h1>
              <p style="color:#93c5fd;margin:0;font-size:15px;">
                Tu pago fue procesado exitosamente
              </p>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:32px;">
              <p style="font-size:16px;color:#374151;margin:0 0 8px 0;">
                Hola, <strong>${data.nombre}</strong>
              </p>
              <p style="font-size:14px;color:#6b7280;margin:0 0 28px 0;">
                A continuación encontrarás los detalles de tu compra y los códigos QR de tus entradas.
              </p>

              <!-- EVENT CARD -->
              <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:20px 24px;margin-bottom:28px;">
                <p style="font-size:13px;font-weight:600;color:#0369a1;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px 0;">
                  Evento
                </p>
                <h2 style="color:#0c4a6e;font-size:20px;margin:0 0 12px 0;">
                  ${data.eventoTitulo}
                </h2>
                <p style="color:#374151;font-size:14px;margin:4px 0;">
                  📅 <strong>${data.eventoFecha}</strong>
                </p>
                <p style="color:#374151;font-size:14px;margin:4px 0;">
                  📍 <strong>${data.eventoUbicacion}</strong>
                </p>
                <div style="border-top:1px solid #bae6fd;margin-top:14px;padding-top:14px;">
                  <p style="font-size:18px;font-weight:700;color:#059669;margin:0;">
                    Total pagado: ${moneda} ${data.monto.toFixed(2)}
                  </p>
                </div>
              </div>

              <!-- TICKETS -->
              <h3 style="color:#111827;font-size:16px;margin:0 0 12px 0;">
                🎟️ Tus entradas (${data.compras.length})
              </h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;font-size:14px;margin-bottom:28px;">
                <thead>
                  <tr style="background:#f3f4f6;">
                    <th style="padding:10px 16px;text-align:left;color:#374151;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">
                      Asiento
                    </th>
                    <th style="padding:10px 16px;text-align:left;color:#374151;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">
                      Código de entrada
                    </th>
                  </tr>
                </thead>
                <tbody>
                  ${ticketsHtml}
                </tbody>
              </table>

              <!-- INSTRUCCIONES -->
              <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:16px 20px;">
                <p style="color:#92400e;font-size:14px;margin:0;line-height:1.6;">
                  💡 <strong>¿Cómo ingresar al evento?</strong><br>
                  Presenta el código QR de cada entrada al personal en la puerta del evento.<br>
                  También puedes ver y descargar tus entradas en la sección
                  <strong>Mis Compras</strong> de la plataforma.
                </p>
              </div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px;text-align:center;">
              <p style="color:#9ca3af;font-size:12px;margin:0;">
                SistemaTickets 365Soft · No respondas a este correo
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    });

    if (error) {
      console.error('[Email] ❌ Error de Resend al enviar confirmación:', error);
      return;
    }

    console.log(`[Email] ✅ Confirmación de compra enviada a ${data.email}`);
  } catch (err) {
    // No-bloqueante: nunca interrumpir el flujo de pago por un error de email
    console.error('[Email] ❌ Excepción al enviar email de confirmación:', err);
  }
}
