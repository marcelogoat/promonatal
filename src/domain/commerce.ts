import { productById } from './catalog';

export type CartItem = {
  productId: number;
  quantity: number;
  message: string;
  variantId?: number;
  variantTitle?: string;
  priceCents?: number;
};

export const deliveryModes = {
  padrao: { label: 'Frete Grátis Brasil', description: 'Envio seguro com rastreamento (5 a 12 dias úteis)', cents: 0 },
  expressa: { label: 'Envio Expresso Prioritário', description: 'Despacho prioritário com rastreio (7 a 9 dias úteis)', cents: 1990 },
  vip: { label: 'Sedex / Turbo Natal', description: 'Entrega rápida com seguro postal total (5 a 7 dias úteis)', cents: 3490 },
  agendada: { label: 'Envio Programado', description: 'Despacho com data programada', cents: 0 },
};
export type DeliveryMode = keyof typeof deliveryModes;
export const isDeliveryMode = (value: unknown): value is DeliveryMode => typeof value === 'string' && Object.hasOwn(deliveryModes, value);
export const itemKey = (item: CartItem) => JSON.stringify([item.productId, item.message, item.variantId ?? 0]);

export function validateQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new Error('Escolha uma quantidade inteira entre 1 e 99.');
}

export function addItem(
  cart: CartItem[],
  productId: number,
  quantity = 1,
  message = '',
  variantId?: number,
  variantTitle?: string,
  priceCents?: number
): CartItem[] {
  validateQuantity(quantity);
  const product = productById(productId);
  if (product.sold_out) throw new Error('Este produto está esgotado.');
  if (message.length > 200) throw new Error('A mensagem deve ter no máximo 200 caracteres.');
  const item: CartItem = {
    productId,
    quantity,
    message: message.trim(),
    variantId,
    variantTitle,
    priceCents: priceCents ?? product.price_cents,
  };
  const existing = cart.find((line) => itemKey(line) === itemKey(item));
  if (!existing) return [...cart, item];
  validateQuantity(existing.quantity + quantity);
  return cart.map((line) => (itemKey(line) === itemKey(item) ? { ...line, quantity: line.quantity + quantity } : line));
}

export function changeQuantity(cart: CartItem[], key: string, quantity: number): CartItem[] {
  validateQuantity(quantity);
  return cart.map((line) => (itemKey(line) === key ? { ...line, quantity } : line));
}

export function couponRate(code: string): number {
  if (!code.trim()) return 0;
  const upper = code.trim().toUpperCase();
  if (upper === 'NATAL10' || upper === 'FLORES10' || upper === 'NATAL') return 0.1;
  throw new Error('Cupom inválido. Use NATAL10 para 10% OFF.');
}

export function quote(cart: CartItem[], mode: DeliveryMode, coupon: string, extraCents = 0) {
  if (!Number.isSafeInteger(extraCents) || extraCents < 0) throw new Error('Valor adicional inválido.');
  const subtotal = cart.reduce((total, item) => {
    validateQuantity(item.quantity);
    const unitPrice = item.priceCents ?? productById(item.productId).price_cents;
    return total + unitPrice * item.quantity;
  }, 0);
  const discount = Math.round(subtotal * couponRate(coupon));
  const shipping = cart.length ? deliveryModes[mode].cents : 0;
  return { subtotal, discount, shipping, extra: extraCents, total: subtotal - discount + shipping + extraCents };
}
