// src/shared/utils/qrcode.ts
import QRCode from 'qrcode';

export async function generateQRCode(data: string): Promise<string> {
  try {
    const qrDataUrl = await QRCode.toDataURL(data, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    return qrDataUrl;
  } catch (error) {
    console.error('Error generando QR:', error);
    throw new Error('Error generando código QR');
  }
}
