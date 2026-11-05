export const META_PIXEL_ID = '2766907027038424';
const DEFAULT_ACCESS_TOKEN =
  'EAGYyaNTSuUEBS8diRBoZBDsLeMmttdCj68cWRtY5WsoZC8DgGQU3HqcH4uUxBM7FEeBrPvCuiqj2nHnfAw3Q9Ay8X81GVeQFH2ADhrvrAZBdQDCZAGOPva7F83KWAhnmZASu1aF69k5LbJcLboTaVPR5f8FpTVKFsu76sjEGlv0WqOpsKsQZBUFY7X49u5gOjiowZDZD';

export const getMetaAccessToken = () => {
  return (process.env.META_ACCESS_TOKEN || DEFAULT_ACCESS_TOKEN).trim();
};

async function sha256(value: string): Promise<string> {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return '';
  const buffer = new TextEncoder().encode(normalized);
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function parseCookie(cookieHeader: string | null, key: string): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${key}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

export type MetaCustomerData = {
  nome: string;
  email: string;
  telefone: string;
  cidade?: string;
  estado?: string;
  cep?: string;
};

export type MetaPurchaseParams = {
  orderId: string;
  valueCents: number;
  contentIds: (string | number)[];
  numItems: number;
  customer: MetaCustomerData;
  request?: Request;
};

export async function sendMetaConversionPurchase(params: MetaPurchaseParams): Promise<boolean> {
  const token = getMetaAccessToken();
  if (!token) return false;

  try {
    const { orderId, valueCents, contentIds, numItems, customer, request } = params;

    // Normalização de dados do pagador
    const cleanEmail = customer.email.trim().toLowerCase();
    const cleanPhone = customer.telefone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    const nameParts = customer.nome.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const cleanCep = (customer.cep || '').replace(/\D/g, '');
    const cleanCity = (customer.cidade || '').trim().toLowerCase();
    const cleanState = (customer.estado || '').trim().toLowerCase().slice(0, 2);

    const headers = request?.headers;
    const cookieHeader = headers?.get('cookie') || null;
    const fbp = parseCookie(cookieHeader, '_fbp');
    const fbc = parseCookie(cookieHeader, '_fbc');

    const clientIp =
      headers?.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headers?.get('x-real-ip') ||
      headers?.get('cf-connecting-ip') ||
      undefined;

    const userAgent = headers?.get('user-agent') || undefined;

    const [emHash, phHash, fnHash, lnHash, ctHash, stHash, zpHash, countryHash] = await Promise.all([
      sha256(cleanEmail),
      sha256(phoneWithCountry),
      sha256(firstName),
      sha256(lastName),
      sha256(cleanCity),
      sha256(cleanState),
      sha256(cleanCep),
      sha256('br'),
    ]);

    const userData: Record<string, unknown> = {
      em: emHash ? [emHash] : undefined,
      ph: phHash ? [phHash] : undefined,
      fn: fnHash ? [fnHash] : undefined,
      ln: lnHash ? [lnHash] : undefined,
      ct: ctHash ? [ctHash] : undefined,
      st: stHash ? [stHash] : undefined,
      zp: zpHash ? [zpHash] : undefined,
      country: countryHash ? [countryHash] : undefined,
      client_ip_address: clientIp,
      client_user_agent: userAgent,
      fbp,
      fbc,
    };

    // Remove campos indefinidos
    for (const key of Object.keys(userData)) {
      if (userData[key] === undefined) delete userData[key];
    }

    const payload = {
      data: [
        {
          event_name: 'Purchase',
          event_time: Math.floor(Date.now() / 1000),
          event_id: orderId,
          action_source: 'website',
          event_source_url: headers?.get('referer') || undefined,
          user_data: userData,
          custom_data: {
            currency: 'BRL',
            value: Number((valueCents / 100).toFixed(2)),
            content_ids: contentIds.map(String),
            content_type: 'product',
            num_items: numItems,
          },
        },
      ],
    };

    const url = `https://graph.facebook.com/v19.0/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      console.warn('[Meta CAPI] Erro ao enviar evento de compra:', response.status, JSON.stringify(result));
      return false;
    }

    console.log('[Meta CAPI] Evento Purchase enviado com sucesso:', orderId, result);
    return true;
  } catch (error) {
    console.warn('[Meta CAPI] Falha inesperada ao enviar conversão:', error);
    return false;
  }
}

