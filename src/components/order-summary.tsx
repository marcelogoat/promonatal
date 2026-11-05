import { Link } from 'react-router-dom';
import { money, productById } from '@/domain/catalog';
import { deliveryModes, itemKey, quote } from '@/domain/commerce';
import { type Order } from '@/domain/storage';

export const orderLabel = (order: Order) => `#${order.id.slice(5, 13).toUpperCase()}`;
export const orderStatuses = { pending: 'Aguardando pagamento', paid: 'Pagamento confirmado', cancelled: 'Pedido cancelado' };
export const stages = ['Pedido confirmado', 'Separando seu pedido', 'Embalando decorações', 'Saiu para entrega', 'Entregue com carinho'];
export const orderDate = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));

export function OrderSummary({ order }: { order: Order }) {
  const total = quote(order.items, order.mode, order.coupon, order.orderBump?.priceCents ?? 0);
  return <section className="panel confirm-details track-details stack"><h2>Detalhes do pedido</h2><dl>
    <div><dt>Pedido</dt><dd>{orderLabel(order)}</dd></div>
    <div><dt>Data</dt><dd>{orderDate(order.createdAt)}</dd></div>
    <div><dt>Quem recebe</dt><dd>{order.customer.recebedor}</dd></div>
    <div><dt>Endereço</dt><dd>{order.customer.endereco}, {order.customer.numero}<br />{order.customer.complemento && <>{order.customer.complemento}<br /></>}{order.customer.bairro}<br />{order.customer.cidade} – {order.customer.estado}</dd></div>
    <div><dt>Entrega</dt><dd>{deliveryModes[order.mode].label}{order.customer.data && <><br />{order.customer.data.split('-').reverse().join('/')}<br />{order.customer.periodo}</>}</dd></div>
    <div><dt>Pagamento</dt><dd>{orderStatuses[order.status]}</dd></div>
    <div><dt>Frete</dt><dd>{total.shipping ? money(total.shipping) : 'Grátis'}</dd></div>
    {total.discount > 0 && <div><dt>Desconto</dt><dd>– {money(total.discount)}</dd></div>}
    {order.orderBump && <div><dt>Item extra (Oferta)</dt><dd>{money(order.orderBump.priceCents)}</dd></div>}
    <div className="confirm-details__total"><dt>Total</dt><dd data-total>{money(total.total)}</dd></div>
  </dl><div className="stack order-items">{order.items.map((item) => { const product = productById(item.productId); return <Link className="order-item" key={itemKey(item)} to={`/produto/${product.slug}`}><img src={product.image} alt="" width={56} height={56} /><div><strong>{product.name}</strong><p className="muted small">{item.quantity} × {money(product.price_cents)}</p>{item.message && <p className="small">“{item.message}”</p>}</div></Link>; })}{order.orderBump && (() => { const product = productById(order.orderBump.productId); return <Link className="order-item" to={`/produto/${product.slug}`}><img src={product.image} alt="" width={56} height={56} /><div><strong>Item extra – {product.name}</strong><p className="muted small">1 × {money(order.orderBump.priceCents)} (Oferta Especial)</p></div></Link>; })()}</div>{order.customer.mensagem && <p className="order-message">“{order.customer.mensagem}”</p>}</section>;
}

export function OrderList({ orders }: { orders: Order[] }) {
  return <div className="stack">{orders.map((order) => <Link className="panel order-list-item" key={order.id} to={`/acompanhar?id=${order.id}`}><img src={productById(order.items[0].productId).image} alt="" width={64} height={64} /><div><strong>{orderLabel(order)}</strong><p className="small muted">{orderDate(order.createdAt)}</p><p className="small">{order.status === 'paid' ? stages[order.stage] : orderStatuses[order.status]}</p></div><strong>{money(quote(order.items, order.mode, order.coupon, order.orderBump?.priceCents ?? 0).total)}</strong><span aria-hidden="true">›</span></Link>)}</div>;
}
