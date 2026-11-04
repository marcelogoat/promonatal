import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { DemoNotice, EmptyState, Icon, PageFrame } from '@/components/ui';
import { orderLabel } from '@/components/order-summary';
import { trackGoogleConversion } from '@/domain/analytics';
import { money } from '@/domain/catalog';
import { quote } from '@/domain/commerce';
import { getPixStatus } from '@/domain/pix';
import { confirmPayment } from '@/domain/storage';
import { errorMessage, useStore } from '@/store';
import pixCss from '@/styles/pages/pagamento.css?raw';
import cardCss from '@/styles/pages/cartao.css?raw';

export function PaymentPage({ card = false }: { card?: boolean }) {
  const [params] = useSearchParams();
  const { data, transact, notify } = useStore();
  const navigate = useNavigate();
  const [declined, setDeclined] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [copied, setCopied] = useState(false);
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

  useEffect(() => {
    const pendingOrder = order;
    if (card || !pendingOrder?.pix || pendingOrder.status !== 'pending') return;
    const orderId = pendingOrder.id;
    const transactionId = pendingOrder.pix.transactionId;
    const expectedAmount = quote(pendingOrder.items, pendingOrder.mode, pendingOrder.coupon, pendingOrder.orderBump?.priceCents ?? 0).total;
    let active = true;
    const controller = new AbortController();
    async function check() {
      try {
        const result = await getPixStatus(transactionId, controller.signal);
        if (!active) return;
        setStatusError('');
        if (result.status === 'PAID') {
          if (result.amount > 0 && result.amount !== expectedAmount) {
            setStatusError('O valor confirmado pelo gateway não corresponde ao pedido. Fale com o atendimento.');
            return;
          }
          transact((state) => {
            const current = state.orders.find((item) => item.id === orderId);
            if (!current || current.status !== 'pending') return state;
            const paid = confirmPayment(current);
            return { ...state, orders: state.orders.map((item) => item.id === paid.id ? paid : item) };
          });
          navigate(`/obrigado?id=${orderId}`, { replace: true });
        } else if (result.status === 'CANCELLED' || result.status === 'REFUNDED') {
          transact((state) => ({ ...state, orders: state.orders.map((item) => item.id === orderId ? { ...item, status: 'cancelled' as const, stage: 0 } : item) }));
        }
      } catch (error) {
        if (active && !(error instanceof DOMException && error.name === 'AbortError')) setStatusError('Não foi possível atualizar o status agora. Tentaremos novamente.');
      }
    }
    void check();
    const interval = window.setInterval(() => void check(), 5_000);
    return () => { active = false; controller.abort(); window.clearInterval(interval); };
  }, [card, navigate, order, transact]);

  if (!order) return <main className="container"><EmptyState title="Não encontramos este pedido" text="Não foi possível localizar este pedido neste navegador." to="/acompanhar" label="Ver meus pedidos" icon="receipt" /></main>;
  if (order.status === 'paid') return <Navigate replace to={`/obrigado?id=${order.id}`} />;
  if (order.status === 'cancelled') return <main className="container"><EmptyState title="Pedido cancelado" text="O PIX expirou ou foi cancelado." /></main>;
  const total = quote(order.items, order.mode, order.coupon, order.orderBump?.priceCents ?? 0).total;
  if (!card && !order.pix) return <main className="container"><EmptyState title="PIX indisponível para este pedido" text="Este pedido foi criado antes da integração de pagamentos. Gere um novo pedido." to="/" label="Escolher produtos" /></main>;

  function pay() {
    if (!order) return;
    if (transact((state) => {
      const current = state.orders.find((item) => item.id === order.id);
      if (!current) throw new Error('Este pedido não está mais disponível.');
      const paid = confirmPayment(current);
      return { ...state, orders: state.orders.map((item) => item.id === paid.id ? paid : item) };
    })) navigate(`/obrigado?id=${order.id}`);
  }

  async function copy() {
    try {
      if (!order?.pix) return;
      await navigator.clipboard.writeText(order.pix.paymentData.copyPaste);
      setCopied(true);
      notify('Código PIX copiado com sucesso.');
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      notify(`Não foi possível copiar: ${errorMessage(error)}`);
    }
  }

  return <PageFrame name={card ? 'cartao' : 'pagamento'} css={card ? cardCss : pixCss}>
    <main className="container pay">
      <header className="pay__head"><span className="pay__kicker">Pagamento Seguro com {card ? 'Cartão' : 'PIX'}</span><h1 className="pay__title">Falta pouco para o seu Natal Encantado!</h1><p className="pay__sub">Pedido <strong>{orderLabel(order)}</strong></p><p className="pay__status" role="status"><span className="pay__dot" />Aguardando {card ? 'confirmação' : 'pagamento'}</p></header>
      {card && <div className="payment-demo"><DemoNotice /></div>}
      {card
        ? <section className="pay__card stack"><p className="pay__total">Total do pedido: <strong>{money(total)}</strong></p><div className="demo-credit-card" aria-label="Cartão demonstrativo de pagamento"><span>ENCANTO NATALINO · OFICIAL</span><Icon name="tree" /><strong>•••• &nbsp; •••• &nbsp; •••• &nbsp; 4242</strong><span>{(order.customer?.nome || 'CLIENTE DEMONSTRAÇÃO').toUpperCase()}</span></div><p className="muted small">Pagamento 100% criptografado e seguro. Modo demonstrativo com aprovação instantânea.</p>{declined && <p className="form-error" role="alert">Recusa simulada. Nenhuma cobrança aconteceu. Você pode tentar aprovar novamente.</p>}<button className="btn btn--primary btn--block" onClick={pay}>Aprovar pagamento · {money(total)}</button><button className="btn btn--soft btn--block" onClick={() => setDeclined(true)}>Simular cartão recusado</button></section>
        : order.pix && <section className="pay__qr-card">
            <span className="pay__corner pay__corner--tl" />
            <span className="pay__corner pay__corner--tr" />
            <span className="pay__corner pay__corner--bl" />
            <span className="pay__corner pay__corner--br" />
            <div className="pay__timer"><strong className="pay__timer-num">{money(total)}</strong></div>
            <div className="pay__qr-frame">
              <img src={order.pix.paymentData.qrCodeBase64} alt="QR Code PIX do pedido" />
            </div>
            <p className="pay__total">Escaneie o QR Code no app do seu banco ou copie o código abaixo:</p>
            <div className="pay__copy">
              <label className="pay__copy-label" htmlFor="pix-code">Código PIX Copia e Cola</label>
              <div className="pay__copy-row">
                <input className="pay__code" id="pix-code" value={order.pix.paymentData.copyPaste} readOnly onClick={(e) => (e.target as HTMLInputElement).select()} />
              </div>
              <button type="button" className={`pay__copy-full-btn${copied ? ' is-copied' : ''}`} onClick={copy}>
                <Icon name={copied ? 'check' : 'doc'} />
                {copied ? 'Código PIX Copiado com Sucesso!' : 'Copiar Código PIX'}
              </button>
              <p className="pay__copy-hint">Válido até {new Date(order.pix.paymentData.expiresAt).toLocaleString('pt-BR')}.</p>
            </div>

            <div className="pay__steps">
              <h2 className="pay__steps-title">
                <Icon name="bolt" /> Passo a passo para pagar:
              </h2>
              <ol>
                <li>
                  <span>Abra o app do seu <strong>banco ou carteira digital</strong> no celular.</span>
                </li>
                <li>
                  <span>Acesse a área <strong>PIX</strong> e escolha <strong>PIX Copia e Cola</strong> (ou <strong>Ler QR Code</strong>).</span>
                </li>
                <li>
                  <span><strong>Cole o código</strong> copiado acima (ou aponte a câmera para o QR Code).</span>
                </li>
                <li>
                  <span>Confira as informações e confirme o pagamento de <strong>{money(total)}</strong>.</span>
                </li>
              </ol>
              <div className="pay__steps-confirm">
                <Icon name="check" />
                <span><strong>Aprovação em segundos:</strong> assim que você pagar no banco, seu pedido é confirmado aqui automaticamente!</span>
              </div>
            </div>

            {statusError && <p className="form-error pay__status-error" role="status">{statusError}</p>}
          </section>}
      <div className="pay__actions payment-switch">{card && order.pix && <Link className="btn btn--soft btn--block" to={`/pagamento?id=${order.id}`}>Prefiro pagar com PIX</Link>}<Link className="text-link" to={`/acompanhar?id=${order.id}`}>Ver detalhes do pedido</Link></div>
      <p className="pay__note">{card ? 'Ambiente protegido com criptografia SSL 256 bits.' : 'A confirmação do PIX é automática e o rastreio será enviado ao seu e-mail.'} Dúvidas? <Link to="/atendimento">Fale com o suporte</Link>.</p>
    </main>
  </PageFrame>;
}
