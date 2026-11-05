import { productById } from '../domain/catalog';
import { validateCheckout, type CheckoutData } from '../domain/checkout';
import { isDeliveryMode, quote, type CartItem } from '../domain/commerce';

const API_URL = 'https://api.blackcatoficial.com/api';
export const gatewayKey = (provided?: string) => {
  const key = provided && provided.startsWith('sk_') ? provided : process.env.BLACKCAT_SECRET_KEY ?? '';
  if (!key.startsWith('sk_')) throw new Error('Gateway PIX não configurado.');
  return key;
};
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store' };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: jsonHeaders });
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, max = 200): value is string => typeof value === 'string' && value.length <= max;
const digits = (value: string) => value.replace(/\D/g, '');
const pickText = (source: Record<string, unknown>, keys: string[], max: number) => {
  for (const key of keys) if (text(source[key], max) && (source[key] as string).trim()) return source[key] as string;
  return '';
};

type PixPayment = {
  transactionId: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  amount: number;
  invoiceUrl?: string;
  paymentData: { qrCode: string; qrCodeBase64: string; copyPaste: string; expiresAt: string };
};

function checkoutFrom(value: unknown): CheckoutData {
  if (!record(value)) throw new Error('Dados do checkout inválidos.');
  const keys: (keyof Omit<CheckoutData, 'mode'>)[] = ['nome', 'telefone', 'cpf', 'email', 'recebedor', 'mensagem', 'cep', 'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'data', 'periodo'];
  const data: Record<string, string> = {};
  for (const key of keys) {
    if (!text(value[key])) throw new Error('Dados do checkout inválidos.');
    data[key] = value[key] as string;
  }
  if (!isDeliveryMode(value.mode)) throw new Error('Modalidade de entrega inválida.');
  const checkout = { ...data, mode: value.mode } as CheckoutData;
  if (Object.keys(validateCheckout(checkout)).length) throw new Error('Confira os dados do checkout.');
  return checkout;
}

function cartFrom(value: unknown): CartItem[] {
  if (!Array.isArray(value) || !value.length || value.length > 100) throw new Error('Sacola inválida.');
  return value.map((line) => {
    if (!record(line) || typeof line.productId !== 'number' || typeof line.quantity !== 'number' || !text(line.message)) throw new Error('Sacola inválida.');
    productById(line.productId);
    return { productId: line.productId, quantity: line.quantity, message: line.message };
  });
}

async function blackcat(path: string, apiKey: string, init?: RequestInit): Promise<Response> {
  const key = gatewayKey(apiKey);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'X-API-Key': key, ...init?.headers },
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function createPixResponse(request: Request, apiKey = ''): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  try {
    const raw: unknown = await request.json();
    if (!record(raw) || !text(raw.orderId, 80) || !/^natal_[a-fA-F0-9-]{36}$/.test(raw.orderId as string)) return json({ error: 'Pedido inválido.' }, 400);
    if (!text(raw.coupon, 40)) return json({ error: 'Cupom inválido.' }, 400);
    const checkout = checkoutFrom(raw.checkout);
    const cart = cartFrom(raw.cart);
    const extraCents = typeof raw.extraCents === 'number' && Number.isSafeInteger(raw.extraCents) && raw.extraCents >= 0 ? raw.extraCents : 0;
    // Bump is product 604 (Kit 32 Enfeites Azul, Branco e Prata) at R$ 32,90
    const expectedBump = extraCents > 0 ? 3290 : 0;
    if (extraCents !== expectedBump) return json({ error: 'Oferta adicional inválida.' }, 400);
    const totals = quote(cart, checkout.mode, raw.coupon as string, extraCents);
    if (totals.total < 100 || totals.total > 10_000_000) return json({ error: 'Valor do pedido inválido.' }, 400);
    const itemCount = cart.reduce((total, item) => total + item.quantity, 0);
    const upstream = await blackcat('/sales/create-sale', apiKey, {
      method: 'POST',
      body: JSON.stringify({
        amount: totals.total,
        currency: 'BRL',
        paymentMethod: 'pix',
        items: [{ title: `Encanto Natalino — Pedido (${itemCount} ${itemCount === 1 ? 'item' : 'itens'})`, unitPrice: totals.total, quantity: 1, tangible: true }],
        customer: {
          name: checkout.nome.trim(),
          email: checkout.email.trim().toLowerCase(),
          phone: digits(checkout.telefone),
          document: { number: digits(checkout.cpf), type: 'cpf' },
        },
        shipping: {
          name: checkout.recebedor.trim(),
          street: checkout.endereco.trim(),
          number: checkout.numero.trim(),
          complement: checkout.complemento.trim(),
          neighborhood: checkout.bairro.trim(),
          city: checkout.cidade.trim(),
          state: checkout.estado,
          zipCode: digits(checkout.cep),
        },
        pix: { expiresInDays: 1 },
        externalRef: raw.orderId,
        metadata: JSON.stringify({ source: 'encanto-natalino', deliveryMode: checkout.mode }),
      }),
    });
    const result: unknown = await upstream.json().catch(() => null);

    // BlackCat may respond with { success, data } wrapper OR directly with the charge object
    if (!upstream.ok || !record(result)) {
      const errMsg = record(result) && text(result.message, 300)
        ? result.message
        : record(result) && text(result.error, 300)
          ? result.error
          : 'O gateway não conseguiu gerar o PIX. Tente novamente.';
      console.error('[PIX] upstream error', upstream.status, JSON.stringify(result).slice(0, 500));
      return json({ error: errMsg }, upstream.status >= 400 && upstream.status < 500 ? 400 : 502);
    }

    // Support both wrapped { success, data } and flat response shapes
    const data: Record<string, unknown> = record(result.data) ? (result.data as Record<string, unknown>) : result;

    // paymentData nested object or root-level fields
    const paymentData: Record<string, unknown> =
      record(data.paymentData) ? (data.paymentData as Record<string, unknown>) :
      record(data.pix) ? (data.pix as Record<string, unknown>) :
      record(data.pixData) ? (data.pixData as Record<string, unknown>) :
      data;

    const transactionId = pickText(data, ['transactionId', 'transaction_id', 'id', '_id'], 120);
    const status = pickText(data, ['status'], 20) || 'PENDING';

    // brCode is the official EMV string in BlackCat responses; fallback to other common names
    const copyPaste = pickText(paymentData, ['brCode', 'copyPaste', 'copy_paste', 'pixCopyPaste', 'pixCopiaECola', 'payload', 'emv', 'qrCode', 'qrcode', 'qr_code'], 10_000);

    // brCodeBase64 is the official QR image field in BlackCat responses
    const imageValue = pickText(paymentData, ['brCodeBase64', 'qrCodeBase64', 'qr_code_base64', 'base64', 'qrCodeImage', 'qrcodeImage', 'qrCode64'], 2_000_000);
    const qrCodeBase64 =
      /^data:image\/(?:png|jpeg|webp);base64,/i.test(imageValue) ? imageValue :
      /^[A-Za-z0-9+/=\s]+$/.test(imageValue) && imageValue.length > 100 ? `data:image/png;base64,${imageValue.replace(/\s/g, '')}` :
      '';

    const expiresValue = pickText(paymentData, ['expiresAt', 'expires_at', 'expirationDate', 'expiration_date'], 100);
    const expiresAt = Number.isFinite(Date.parse(expiresValue))
      ? new Date(expiresValue).toISOString()
      : new Date(Date.now() + 86_400_000).toISOString();

    if (!transactionId || !copyPaste) {
      console.error('[PIX] incomplete response — transactionId:', transactionId, 'copyPaste:', copyPaste ? 'ok' : 'missing', JSON.stringify(result).slice(0, 500));
      return json({ error: 'O gateway retornou um PIX incompleto.' }, 502);
    }

    const normalizedStatus = status.toUpperCase();
    const payment: PixPayment = {
      transactionId,
      status: ['PAID', 'APPROVED', 'COMPLETED'].includes(normalizedStatus) ? 'PAID'
            : ['CANCELLED', 'EXPIRED', 'REFUNDED'].includes(normalizedStatus) ? 'CANCELLED'
            : 'PENDING',
      // Always use our calculated total — we control the amount sent to the gateway
      amount: totals.total,
      invoiceUrl: text(data.invoiceUrl, 2_000) ? (data.invoiceUrl as string) : undefined,
      paymentData: {
        qrCode: copyPaste,
        qrCodeBase64,
        copyPaste,
        expiresAt,
      },
    };
    return json(payment, 201);
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: 'Corpo da requisição inválido.' }, 400);
    if (error instanceof Error && /inválid|Confira|Cupom/.test(error.message)) return json({ error: error.message }, 400);
    console.error('[PIX] unexpected error', error);
    return json({ error: error instanceof Error && error.message === 'Gateway PIX não configurado.' ? error.message : 'Não foi possível gerar o PIX agora.' }, 502);
  }
}

export async function pixStatusResponse(transactionId: string, apiKey = ''): Promise<Response> {
  if (!/^[A-Za-z0-9_-]{6,120}$/.test(transactionId)) return json({ error: 'Transação inválida.' }, 400);
  try {
    const upstream = await blackcat(`/sales/${encodeURIComponent(transactionId)}/status`, gatewayKey(apiKey));
    const result: unknown = await upstream.json().catch(() => null);
    if (!upstream.ok || !record(result)) return json({ error: 'Não foi possível consultar o pagamento.' }, 502);

    // Support both wrapped { success, data } and flat response
    const data: Record<string, unknown> = record(result.data) ? (result.data as Record<string, unknown>) : result;
    const status = pickText(data, ['status'], 20);
    if (!status) return json({ error: 'Não foi possível consultar o pagamento.' }, 502);

    const normalizedStatus = status.toUpperCase();
    const mappedStatus =
      ['PAID', 'APPROVED', 'COMPLETED'].includes(normalizedStatus) ? 'PAID' :
      ['CANCELLED', 'EXPIRED'].includes(normalizedStatus) ? 'CANCELLED' :
      ['REFUNDED'].includes(normalizedStatus) ? 'REFUNDED' :
      'PENDING';

    const amount = typeof data.amount === 'number' ? data.amount : typeof result.amount === 'number' ? result.amount : 0;
    return json({ status: mappedStatus, amount });
  } catch {
    return json({ error: 'Não foi possível consultar o pagamento.' }, 502);
  }
}
