import { productById } from './catalog';
import { isDeliveryMode, itemKey, quote, validateQuantity, type CartItem, type DeliveryMode } from './commerce';
import { states, type CheckoutData } from './checkout';
import type { PixPayment } from './pix';

export { isDeliveryMode };

export type Order = {
  id: string; createdAt: string; items: CartItem[]; coupon: string; mode: DeliveryMode;
  orderBump?: { productId: number; priceCents: number } | null;
  pix?: PixPayment;
  customer: Omit<CheckoutData, 'cpf'>; status: 'pending' | 'paid' | 'cancelled'; stage: number;
};
export type Ticket = { id: string; subject: string; message: string; email: string; createdAt: string };
export type StoreData = {
  version: 1; cart: CartItem[]; coupon: string; cardMessage: string; orders: Order[]; tickets: Ticket[];
  city: { name: string; uf: string } | null; profile: { name: string; email: string } | null;
};
export const STORAGE_KEY = 'rosa.frontend.v1';
export const emptyStore = (): StoreData => ({ version: 1, cart: [], coupon: '', cardMessage: '', orders: [], tickets: [], city: null, profile: null });
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, max = 200): value is string => typeof value === 'string' && value.length <= max;
const email = (value: unknown): value is string => text(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const date = (value: unknown): value is string => text(value) && /^\d{4}-\d{2}-\d{2}/.test(value);

function isPixPayment(value: unknown): value is PixPayment {
  if (!record(value) || !text(value.transactionId, 120) || !record(value.paymentData)) return false;
  return typeof value.paymentData.copyPaste === 'string';
}

function isCart(value: unknown): value is CartItem[] {
  if (!Array.isArray(value) || value.length > 500) return false;
  const keys = new Set<string>();
  return value.every((item: unknown) => {
    if (!record(item) || typeof item.productId !== 'number' || typeof item.quantity !== 'number' || !text(item.message)) return false;
    try { productById(item.productId); validateQuantity(item.quantity); } catch { return false; }
    const key = itemKey({ productId: item.productId, quantity: item.quantity, message: item.message });
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
}

function isCustomer(value: unknown): value is Order['customer'] {
  if (!record(value)) return false;
  const keys = ['nome', 'telefone', 'email', 'recebedor', 'mensagem', 'cep', 'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'estado'];
  return keys.every((key) => typeof value[key] === 'string') && email(value.email) && typeof value.estado === 'string';
}

function isOrder(value: unknown): value is Order {
  if (!record(value) || !text(value.id, 100) || !/^[a-zA-Z0-9_-]{6,100}$/.test(value.id)) return false;
  if (!date(value.createdAt) || !isCart(value.items) || !value.items.length) return false;
  if (!isDeliveryMode(value.mode) || !isCustomer(value.customer)) return false;
  if (value.orderBump !== undefined && value.orderBump !== null) {
    if (!record(value.orderBump) || typeof value.orderBump.productId !== 'number' || typeof value.orderBump.priceCents !== 'number') return false;
    try { productById(value.orderBump.productId); } catch { return false; }
  }
  if (value.pix !== undefined && value.pix !== null && !isPixPayment(value.pix)) return false;
  if (typeof value.status !== 'string' || !['pending', 'paid', 'cancelled'].includes(value.status)) return false;
  return true;
}

function isTicket(value: unknown): value is Ticket {
  return record(value) && text(value.id) && text(value.subject) && text(value.message, 2000) && email(value.email) && date(value.createdAt);
}

export function decodeStore(serialized: string): StoreData {
  try {
    const data: unknown = JSON.parse(serialized);
    if (!record(data)) return emptyStore();
    const cardMessage = typeof data.cardMessage === 'string' ? data.cardMessage : '';
    const cart = Array.isArray(data.cart) ? data.cart.filter((item) => {
      try {
        if (!record(item) || typeof item.productId !== 'number' || typeof item.quantity !== 'number') return false;
        productById(item.productId);
        return true;
      } catch { return false; }
    }) : [];
    const orders = Array.isArray(data.orders) ? data.orders.filter(isOrder) : [];
    const tickets = Array.isArray(data.tickets) ? data.tickets.filter(isTicket) : [];
    return {
      version: 1,
      cart,
      coupon: typeof data.coupon === 'string' ? data.coupon : '',
      cardMessage,
      orders,
      tickets,
      city: record(data.city) && typeof data.city.name === 'string' && typeof data.city.uf === 'string' && states.includes(data.city.uf) ? { name: data.city.name, uf: data.city.uf } : null,
      profile: record(data.profile) && typeof data.profile.name === 'string' && typeof data.profile.email === 'string' && email(data.profile.email) ? { name: data.profile.name, email: data.profile.email } : null,
    };
  } catch {
    return emptyStore();
  }
}

export function safeRandomUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // fallback
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function createOrder(data: CheckoutData, cart: CartItem[], coupon: string, orderBump: Order['orderBump'] = null, id = `natal_${safeRandomUUID()}`, pix?: PixPayment): Order {
  if (!cart.length) throw new Error('Sua sacola está vazia.');
  for (const item of cart) if (productById(item.productId).sold_out) throw new Error('Remova o produto esgotado antes de continuar.');
  quote(cart, data.mode, coupon, orderBump?.priceCents ?? 0);
  const { cpf: omittedCpf, ...customer } = data;
  void omittedCpf;
  return { id, createdAt: new Date().toISOString(), items: cart.map((item) => ({ ...item })), coupon, mode: data.mode, orderBump, pix, customer, status: pix?.status === 'PAID' ? 'paid' : 'pending', stage: 0 };
}

export function confirmPayment(order: Order): Order {
  if (order.status === 'cancelled') throw new Error('Este pedido foi cancelado.');
  return { ...order, status: 'paid' };
}

export function advanceOrder(order: Order): Order {
  if (order.status !== 'paid') throw new Error('Confirme o pagamento demonstrativo primeiro.');
  return { ...order, stage: Math.min(4, order.stage + 1) };
}
