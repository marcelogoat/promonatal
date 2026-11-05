declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

export const GOOGLE_ADS_ID = 'AW-18544489284';
export const GOOGLE_CONVERSION_SEND_TO = 'AW-18544489284/WMFdCMrdlLIdEMTm2YpF';
export const FACEBOOK_PIXEL_ID = '2766907027038424';

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

function ensureFbq(): (...args: unknown[]) => void {
  if (typeof window === 'undefined') return () => {};
  if (typeof window.fbq === 'function') return window.fbq;
  return () => {};
}

// ── Google Ads ────────────────────────────────────────────────────────────
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

// ── Meta / Facebook Pixel ─────────────────────────────────────────────────
export function trackFbPageView() {
  if (typeof window === 'undefined') return;
  const fbq = ensureFbq();
  fbq('track', 'PageView');
}

export function trackFbInitiateCheckout(
  valueCents: number,
  numItems = 1,
  contentIds: (string | number)[] = []
) {
  if (typeof window === 'undefined') return;
  const fbq = ensureFbq();
  const valueInReais = Number((valueCents / 100).toFixed(2));

  fbq('track', 'InitiateCheckout', {
    value: valueInReais,
    currency: 'BRL',
    num_items: numItems,
    content_ids: contentIds.map(String),
    content_type: 'product',
  });

  console.log('[Meta Pixel] InitiateCheckout registrado:', {
    value: valueInReais,
    num_items: numItems,
    content_ids: contentIds,
  });
}

export function trackFbPurchase(
  valueCents: number,
  orderId: string,
  contentIds: (string | number)[] = [],
  numItems = 1
) {
  if (typeof window === 'undefined') return;
  const fbq = ensureFbq();
  const valueInReais = Number((valueCents / 100).toFixed(2));

  fbq(
    'track',
    'Purchase',
    {
      value: valueInReais,
      currency: 'BRL',
      transaction_id: orderId,
      content_ids: contentIds.map(String),
      content_type: 'product',
      num_items: numItems,
    },
    { eventID: orderId }
  );

  console.log('[Meta Pixel] Purchase registrado:', {
    value: valueInReais,
    transaction_id: orderId,
    content_ids: contentIds,
    num_items: numItems,
  });
}

// ── Helper unificado de conversão (Google + Meta) ──────────────────────────
export function trackPurchaseConversion(
  valueCents: number,
  orderId: string,
  contentIds: (string | number)[] = [],
  numItems = 1
) {
  trackGoogleConversion(valueCents, orderId);
  trackFbPurchase(valueCents, orderId, contentIds, numItems);
}
