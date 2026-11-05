import { productById } from '../domain/catalog';
import { validateCheckout, type CheckoutData } from '../domain/checkout';
import { isDeliveryMode, quote, deliveryModes, type CartItem } from '../domain/commerce';
import { sendMetaConversionPurchase } from './meta';

const VENO_API_URL = 'https://beta.venopayments.com/api/v1';
const BLACKCAT_API_URL = 'https://api.blackcatoficial.com/api';

export const gatewayKey = (provided?: string) => {
  const key = (
    provided ||
    process.env.VENO_API_KEY ||
    process.env.VENO_SECRET_KEY ||
    process.env.BLACKCAT_SECRET_KEY ||
    ''
  ).trim();
  if (!key) throw new Error('Gateway PIX não configurado.');
  // Se for uma chave Veno sem o prefixo veno_live_, normaliza
  if (!key.startsWith('sk_') && !key.startsWith('veno_live_')) {
    return `veno_live_${key}`;
  }
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
    const product = productById(line.productId);
    const variantTitle = typeof line.variantTitle === 'string' && line.variantTitle.length <= 100 ? line.variantTitle : undefined;
    const variantId = typeof line.variantId === 'number' ? line.variantId : undefined;
    const priceCents = typeof line.priceCents === 'number' && Number.isSafeInteger(line.priceCents) && line.priceCents > 0 ? line.priceCents : product.price_cents;
    return { productId: line.productId, quantity: line.quantity, message: line.message, variantTitle, variantId, priceCents };
  });
}

async function requestGateway(path: string, key: string, init?: RequestInit): Promise<Response> {
  const isBlackCat = key.startsWith('sk_');
  const baseUrl = isBlackCat ? BLACKCAT_API_URL : VENO_API_URL;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(isBlackCat ? { 'X-API-Key': key } : { Authorization: `Bearer ${key}` }),
    ...((init?.headers as Record<string, string>) || {}),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(`${baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers,
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
    const itemCount = cart.reduce((total, item) => total + item.quantity, 0) + (extraCents > 0 ? 1 : 0);
    const utms = record(raw.utms) ? (raw.utms as Record<string, string>) : {};

    const key = gatewayKey(apiKey);
    const isBlackCat = key.startsWith('sk_');

    let upstream: Response;

    if (isBlackCat) {
      upstream = await requestGateway('/sales/create-sale', key, {
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
    } else {
      // Build detailed products list for Veno / Pagar.me
      type VenoProduct = { external_ref: string; name: string; price: number; quantity: number };
      const venoProducts: VenoProduct[] = [];

      for (let i = 0; i < cart.length; i++) {
        const item = cart[i];
        const prod = productById(item.productId);
        const name = item.variantTitle
          ? `${prod.name} (${item.variantTitle})`
          : prod.name;
        const unitPrice = item.priceCents || prod.price_cents;
        venoProducts.push({
          external_ref: `${raw.orderId}_item_${i + 1}_${item.productId}`.slice(0, 50),
          name: name.slice(0, 120),
          price: unitPrice,
          quantity: item.quantity,
        });
      }

      // Order bump if selected
      if (extraCents > 0) {
        const bumpProd = productById(604);
        venoProducts.push({
          external_ref: `${raw.orderId}_bump_604`.slice(0, 50),
          name: `${bumpProd.name} (Oferta Especial)`.slice(0, 120),
          price: extraCents,
          quantity: 1,
        });
      }

      // Shipping line if not free
      if (totals.shipping > 0) {
        venoProducts.push({
          external_ref: `${raw.orderId}_frete`.slice(0, 50),
          name: `Frete: ${deliveryModes[checkout.mode].label}`.slice(0, 120),
          price: totals.shipping,
          quantity: 1,
        });
      }

      // Guarantee sum(price * quantity) === totals.total down to the exact cent
      const currentSum = venoProducts.reduce((sum, p) => sum + p.price * p.quantity, 0);
      const diff = totals.total - currentSum;
      if (diff !== 0 && venoProducts.length > 0) {
        const adjusted = venoProducts[0].price + Math.floor(diff / venoProducts[0].quantity);
        if (adjusted > 0) {
          venoProducts[0].price = adjusted;
          const remainder = totals.total - venoProducts.reduce((sum, p) => sum + p.price * p.quantity, 0);
          if (remainder !== 0 && venoProducts[0].quantity === 1) {
            venoProducts[0].price += remainder;
          }
        }
      }

      const firstProduct = productById(cart[0].productId);
      const mainTitle = cart[0].variantTitle
        ? `${firstProduct.name} (${cart[0].variantTitle})`
        : firstProduct.name;
      const description = cart.length === 1 && extraCents === 0
        ? `${mainTitle} – Encanto Natalino`.slice(0, 100)
        : `${mainTitle} + itens – Encanto Natalino`.slice(0, 100);

      const venoBody: Record<string, unknown> = {
        amount: totals.total,
        description,
        external_id: raw.orderId as string,
        payer: {
          name: checkout.nome.trim(),
          email: checkout.email.trim().toLowerCase(),
          document: digits(checkout.cpf),
          phone: digits(checkout.telefone),
          address: `${checkout.endereco.trim()}, ${checkout.numero.trim()}${checkout.complemento ? ' - ' + checkout.complemento.trim() : ''}`,
          city: checkout.cidade.trim(),
          state: checkout.estado.trim().slice(0, 2).toUpperCase(),
          zip_code: digits(checkout.cep),
        },
        products: venoProducts,
        utm_source: text(utms.utm_source, 100) ? utms.utm_source : undefined,
        utm_campaign: text(utms.utm_campaign, 100) ? utms.utm_campaign : undefined,
        utm_medium: text(utms.utm_medium, 100) ? utms.utm_medium : undefined,
        utm_content: text(utms.utm_content, 100) ? utms.utm_content : undefined,
        utm_term: text(utms.utm_term, 100) ? utms.utm_term : undefined,
        src: text(utms.src, 100) ? utms.src : undefined,
        sck: text(utms.sck, 100) ? utms.sck : undefined,
      };

      for (const k of Object.keys(venoBody)) {
        if (venoBody[k] === undefined) delete venoBody[k];
      }

      // Veno Payments API PIX (POST /api/v1/pix)
      upstream = await requestGateway('/pix', key, {
        method: 'POST',
        body: JSON.stringify(venoBody),
      });
    }

    const result: unknown = await upstream.json().catch(() => null);

    if (!upstream.ok || !record(result)) {
      const errMsg =
        (record(result) && text(result.message, 300) && result.message) ||
        (record(result) && text(result.error, 300) && result.error) ||
        'O gateway não conseguiu gerar o PIX. Tente novamente.';
      console.error('[PIX] upstream error', upstream.status, JSON.stringify(result).slice(0, 500));
      return json({ error: errMsg }, upstream.status >= 400 && upstream.status < 500 ? 400 : 502);
    }

    // Support Veno ({ id, pix_copy_paste, qr_code_image, ... }) as well as BlackCat ({ success, data })
    const data: Record<string, unknown> = record(result.data) ? (result.data as Record<string, unknown>) : result;

    const paymentData: Record<string, unknown> =
      record(data.paymentData) ? (data.paymentData as Record<string, unknown>) :
      record(data.pix) ? (data.pix as Record<string, unknown>) :
      record(data.pixData) ? (data.pixData as Record<string, unknown>) :
      data;

    const transactionId = pickText(data, ['transactionId', 'transaction_id', 'id', 'txid', '_id'], 120);
    const status = pickText(data, ['status'], 20) || 'PENDING';

    const copyPaste = pickText(paymentData, [
      'pix_copy_paste',
      'qr_code_image',
      'brCode',
      'copyPaste',
      'copy_paste',
      'pixCopyPaste',
      'pixCopiaECola',
      'payload',
      'emv',
      'qrCode',
      'qrcode',
      'qr_code',
    ], 10_000);

    const imageValue = pickText(paymentData, [
      'qr_code_image',
      'brCodeBase64',
      'qrCodeBase64',
      'qr_code_base64',
      'base64',
      'qrCodeImage',
      'qrcodeImage',
      'qrCode64',
    ], 2_000_000);

    const qrCodeBase64 =
      /^data:image\/(?:png|jpeg|webp);base64,/i.test(imageValue) ? imageValue :
      /^[A-Za-z0-9+/=\s]+$/.test(imageValue) && imageValue.length > 100 ? `data:image/png;base64,${imageValue.replace(/\s/g, '')}` :
      '';

    const expiresValue = pickText(paymentData, ['expires_at', 'expiresAt', 'expirationDate', 'expiration_date'], 100);
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
      amount: totals.total,
      invoiceUrl: text(data.invoiceUrl, 2_000) ? (data.invoiceUrl as string) : undefined,
      paymentData: {
        qrCode: copyPaste,
        qrCodeBase64,
        copyPaste,
        expiresAt,
      },
    };

    // Send Server-Side Conversion to Meta (CAPI) with automatic deduplication
    try {
      const contentIds = cart.map((i) => i.productId);
      if (extraCents > 0) contentIds.push(604);
      sendMetaConversionPurchase({
        orderId: raw.orderId as string,
        valueCents: totals.total,
        contentIds,
        numItems: itemCount,
        customer: {
          nome: checkout.nome,
          email: checkout.email,
          telefone: checkout.telefone,
          cidade: checkout.cidade,
          estado: checkout.estado,
          cep: checkout.cep,
        },
        request,
      }).catch((err) => console.warn('[Meta CAPI] error sending purchase:', err));
    } catch (metaErr) {
      console.warn('[Meta CAPI] failed to dispatch:', metaErr);
    }

    return json(payment, 201);
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: 'Corpo da requisição inválido.' }, 400);
    if (error instanceof Error && /inválid|Confira|Cupom/.test(error.message)) return json({ error: error.message }, 400);
    console.error('[PIX] unexpected error', error);
    return json({ error: error instanceof Error && error.message.includes('não configurado') ? error.message : 'Não foi possível gerar o PIX agora.' }, 502);
  }
}

export async function pixStatusResponse(transactionId: string, apiKey = ''): Promise<Response> {
  if (!/^[A-Za-z0-9_-]{6,120}$/.test(transactionId)) return json({ error: 'Transação inválida.' }, 400);
  try {
    const key = gatewayKey(apiKey);
    const isBlackCat = key.startsWith('sk_');
    const path = isBlackCat ? `/sales/${encodeURIComponent(transactionId)}/status` : `/pix/${encodeURIComponent(transactionId)}/status`;

    const upstream = await requestGateway(path, key);
    const result: unknown = await upstream.json().catch(() => null);
    if (!upstream.ok || !record(result)) return json({ error: 'Não foi possível consultar o pagamento.' }, 502);

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
