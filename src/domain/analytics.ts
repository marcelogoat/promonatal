declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export const GOOGLE_ADS_ID = 'AW-18544489284';
export const GOOGLE_CONVERSION_SEND_TO = 'AW-18544489284/WMFdCMrdlLIdEMTm2YpF';

function ensureGtag(): (...args: unknown[]) => void {
  if (typeof window === 'undefined') return () => {};
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function () {
      window.dataLayer?.push(arguments);
    };
  }
  return window.gtag;
}

export function trackGoogleConversion(valueCents: number, transactionId: string) {
  if (typeof window === 'undefined') return;
  const gtag = ensureGtag();
  const valueInReais = Number((valueCents / 100).toFixed(2));
  
  gtag('event', 'conversion', {
    send_to: GOOGLE_CONVERSION_SEND_TO,
    value: valueInReais,
    currency: 'BRL',
    transaction_id: transactionId,
  });

  console.log('[Google Ads] Conversão registrada:', {
    send_to: GOOGLE_CONVERSION_SEND_TO,
    value: valueInReais,
    currency: 'BRL',
    transaction_id: transactionId,
  });
}

export function trackGoogleEvent(eventName: string, params: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;
  const gtag = ensureGtag();
  gtag('event', eventName, params);
}
