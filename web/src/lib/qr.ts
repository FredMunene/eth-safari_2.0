import QRCode from 'qrcode';

export async function generateQRCode(data: string): Promise<string> {
  try {
    return await QRCode.toDataURL(data, {
      width: 300,
      margin: 2,
      color: {
        dark: '#1f2937',
        light: '#ffffff',
      },
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
}

export function createQRPayload(approvalId: string, qrToken: string) {
  return JSON.stringify({
    type: 'travel_approval',
    approvalId,
    token: qrToken,
    timestamp: new Date().toISOString(),
  });
}
