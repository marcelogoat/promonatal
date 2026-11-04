import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DemoNotice, EmptyState, Icon, Modal, PageFrame } from '@/components/ui';
import { OrderList, OrderSummary, orderLabel, stages } from '@/components/order-summary';
import { advanceOrder } from '@/domain/storage';
import { trackGoogleConversion } from '@/domain/analytics';
import { quote } from '@/domain/commerce';
import { useStore } from '@/store';
import confirmationCss from '@/styles/pages/obrigado.css?raw';
import trackingCss from '@/styles/pages/acompanhar.css?raw';

export function ConfirmationPage() {
  const [params] = useSearchParams();
  const { data } = useStore();
  const order = data.orders.find((item) => item.id === params.get('id'));

  useEffect(() => {
    if (!order) return;
    const key = `gads_conv_${order.id}`;
    if (!sessionStorage.getItem(key)) {
      const orderTotal = quote(order.items, order.mode, order.coupon, order.orderBump?.priceCents ?? 0).total;
      trackGoogleConversion(orderTotal, order.id);
      sessionStorage.setItem(key, '1');
    }
  }, [order]);
  if (!order) return <main className="container"><EmptyState title="Pedido não encontrado" text="Consulte seus pedidos demonstrativos neste navegador." to="/acompanhar" label="Meus pedidos" icon="receipt" /></main>;
  const paid = order.status === 'paid';
  return <PageFrame name="obrigado" css={confirmationCss}><main className={`container confirm${paid ? '' : ' confirm--pending'}`}><header className="confirm-hero"><div className="confirm-seal"><Icon name={paid ? 'check' : 'receipt'} /></div><span className="confirm-pill">{paid ? 'Pagamento demonstrativo aprovado' : order.status === 'cancelled' ? 'Pedido cancelado' : 'Aguardando pagamento'}</span><h1 className="confirm-title">{paid ? <>Seu carinho está <em>a caminho!</em></> : 'Seu pedido demonstrativo'}</h1><p className="confirm-headline">{paid ? 'Flores escolhidas com amor. Acompanhe cada etapa do seu pedido abaixo.' : 'Confira os detalhes e o status do pedido.'}</p></header><DemoNotice /><OrderSummary order={order} /><div className="confirm-actions"><Link className="btn btn--action btn--block" to={`/acompanhar?id=${order.id}`}><Icon name="moto" />Acompanhar meu pedido</Link>{order.status === 'pending' && <Link className="btn btn--primary btn--block" to={`/pagamento?id=${order.id}`}>Ir para pagamento</Link>}<Link className="btn btn--soft btn--block" to="/">Continuar comprando</Link><p className="muted">Guarde o número {orderLabel(order)}. O pedido fica salvo somente neste navegador.</p></div><p className="confirm-help">Precisa de ajuda? <Link to="/atendimento">Fale com a gente</Link>.</p></main></PageFrame>;
}

export function TrackingPage() {
  const [params, setParams] = useSearchParams();
  const { data, transact, notify } = useStore();
  const [search, setSearch] = useState('');
  const [searchError, setSearchError] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const id = params.get('id');
  const order = data.orders.find((item) => item.id === id);
  function find(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim().replace(/^#/, '').toLowerCase();
    const found = data.orders.find((item) => item.id.toLowerCase() === query || item.id.slice(5, 13) === query);
    if (!found) { setSearchError('Não encontramos este pedido nos dados locais.'); return; }
    setSearchError('');
    setParams({ id: found.id });
  }
  function advance() {
    if (!order) return;
    if (transact((state) => {
      const current = state.orders.find((item) => item.id === order.id);
      if (!current) throw new Error('Pedido não encontrado.');
      const advanced = advanceOrder(current);
      return { ...state, orders: state.orders.map((item) => item.id === advanced.id ? advanced : item) };
    })) notify('Etapa demonstrativa atualizada.');
  }
  function cancel() {
    if (!order) return;
    if (transact((state) => {
      const current = state.orders.find((item) => item.id === order.id);
      if (!current || current.status !== 'pending') throw new Error('Somente pedidos pendentes podem ser cancelados nesta tela.');
      return { ...state, orders: state.orders.map((item) => item.id === current.id ? { ...item, status: 'cancelled', stage: 0 } : item) };
    })) { setCancelOpen(false); notify('Pedido demonstrativo cancelado.'); }
  }
  return <PageFrame name="acompanhar" css={trackingCss}><main className="container track"><header className="track-hero"><div><p className="track-hero__kicker">{order ? `Pedido ${orderLabel(order)}` : 'Cada carinho tem uma história'}</p><h1 className="track-hero__title">{order?.status === 'paid' && order.stage === 4 ? 'Entregue com carinho' : 'Acompanhar pedido'}</h1></div><span className={`track-hero__icon${order?.stage === 4 ? ' track-hero__icon--done' : ''}`}><Icon name="moto" /></span></header>
    {id && !order ? <EmptyState title="Pedido não encontrado" text="O link não corresponde a um pedido deste navegador. Não acessamos pedidos reais da loja original." to="/acompanhar" label="Ver pedidos locais" icon="receipt" /> : order ? <><div className={`track-note${order.stage === 4 ? ' track-note--done' : order.status !== 'paid' ? ' track-note--wait' : ''}`}><Icon name={order.stage === 4 ? 'check' : 'rose'} /><span>{order.status === 'pending' ? 'Aguardando pagamento demonstrativo' : order.status === 'cancelled' ? 'Pedido cancelado. Nenhuma cobrança realizada.' : stages[order.stage]}</span></div>{order.status === 'paid' && <><section className="panel"><h2 className="sr-only">Etapas da entrega</h2><ol className="tl">{stages.map((stage, index) => <li key={stage} className={`tl__item${index < order.stage || order.stage === 4 ? ' is-done' : index === order.stage ? ' is-current' : ''}`} aria-current={index === order.stage ? 'step' : undefined}><div className="tl__rail"><span className="tl__dot">{(index < order.stage || order.stage === 4) && <Icon name="check" />}</span><span className="tl__line" /></div><div className="tl__body"><p className="tl__label">{stage}</p><p className="tl__meta">{index < order.stage || order.stage === 4 ? 'Concluído na demonstração' : index === order.stage ? 'Etapa atual' : 'Próxima etapa'}</p></div></li>)}</ol></section>{order.stage < 4 && <button className="btn btn--primary btn--block" onClick={advance}>Simular próxima etapa</button>}</>}{order.status === 'pending' && <div className="stack"><Link className="btn btn--primary btn--block" to={`/pagamento?id=${order.id}`}>Concluir Pagamento</Link><button className="text-link" onClick={() => setCancelOpen(true)}>Cancelar pedido</button></div>}<OrderSummary order={order} /><Link className="btn btn--soft btn--block" to="/acompanhar">Todos os meus pedidos</Link><Modal title="Cancelar pedido?" open={cancelOpen} onClose={() => setCancelOpen(false)}><div className="stack"><p>O pedido {orderLabel(order)} será cancelado apenas nesta demonstração. Nenhum valor foi cobrado.</p><button className="btn btn--primary" onClick={cancel}>Confirmar cancelamento</button><button className="btn btn--soft" onClick={() => setCancelOpen(false)}>Manter pedido</button></div></Modal></> : <><p className="muted">Veja seus pedidos ou informe o número para acompanhar.</p><form className="panel stack" onSubmit={find}><label className="field" htmlFor="order-search">Número do pedido<input id="order-search" value={search} onChange={(event) => { setSearch(event.target.value); setSearchError(''); }} placeholder="Ex.: #A1B2C3D4" maxLength={100} required /></label>{searchError && <p role="alert" className="field__error">{searchError}</p>}<button className="btn btn--primary">Buscar pedido</button></form>{data.orders.length ? <OrderList orders={data.orders} /> : <EmptyState title="Seu primeiro carinho começa aqui" text="Você ainda não tem pedidos demonstrativos neste navegador." icon="rose" />}</>}
    <p className="track-help">Precisa de ajuda? <Link to="/atendimento">Fale com o atendimento</Link>.</p></main></PageFrame>;
}
