import type { CheckoutData } from './checkout';
import type { CartItem } from './commerce';
import QRCode from 'qrcode';

export type PixPayment = {
  transactionId: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  amount: number;
  invoiceUrl?: string;
  paymentData: { qrCode: string; qrCodeBase64: string; copyPaste: string; expiresAt: string };
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof result === 'object' && result !== null && 'error' in result && typeof result.error === 'string' ? result.error : 'Não foi possível comunicar com o gateway PIX.';
    throw new Error(message);
  }
  return result as T;
}

export async function createPix(
  orderId: string,
  cart: CartItem[],
  coupon: string,
  checkout: CheckoutData,
  extraCents = 0,
  utms?: Record<string, string>
): Promise<PixPayment> {
  const payment = await api<PixPayment>('/api/pix/create', {
    method: 'POST',
    body: JSON.stringify({ orderId, cart, coupon, checkout, extraCents, utms }),
  });
  if (!payment.paymentData.qrCodeBase64) {
    payment.paymentData.qrCodeBase64 = await QRCode.toDataURL(payment.paymentData.copyPaste, { width: 512, margin: 2, errorCorrectionLevel: 'M' });
  }
  return payment;
}

export function getPixStatus(transactionId: string, signal?: AbortSignal): Promise<{ status: 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED'; amount: number }> {
  return api(`/api/pix/status/${encodeURIComponent(transactionId)}`, { signal });
}
