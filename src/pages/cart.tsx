import { Link, useNavigate } from 'react-router-dom';
import { money, productById, products } from '@/domain/catalog';
import { changeQuantity, itemKey } from '@/domain/commerce';
import { useStore } from '@/store';
import { EmptyState, Icon, PageFrame, Totals } from '@/components/ui';
import css from '@/styles/pages/carrinho.css?inline';

export function CartPage() {
  const { data, transact } = useStore();
  const navigate = useNavigate();

  // Filter valid cart items that exist in current catalog
  const validCartItems = data.cart.filter((item) => products.some((p) => p.id === item.productId));

  return (
    <PageFrame name="carrinho" css={css}>
      <main className="container">
        <header className="page-head">
          <h1 className="title-serif">Sua sacola</h1>
          <p className="muted">Seus produtos de Natal quase a caminho de sua casa.</p>
        </header>

        {!validCartItems.length ? (
          <EmptyState
            title="Sua sacola está vazia"
            text="Que tal escolher árvores e decorações para o seu Natal?"
            to="/"
            label="Ver árvores e decorações"
          />
        ) : (
          <>
            <div className="freebar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="1" y="3" width="15" height="13" rx="2" />
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
              <span>Você ganhou frete grátis para todo o Brasil!</span>
            </div>

            <div className="cart-layout">
              <section aria-label="Itens da sacola">
                {validCartItems.map((item) => {
                  const product = productById(item.productId);
                  const key = itemKey(item);
                  const unitPrice = item.priceCents ?? product.price_cents;

                  return (
                    <article className="cartitem" key={key}>
                      <Link className="cartitem__media" to={`/produto/${product.slug}`}>
                        <img src={product.image} alt={product.name} width={96} height={96} />
                      </Link>
                      <div className="cartitem__body">
                        <div className="cartitem__top">
                          <Link className="cartitem__name" to={`/produto/${product.slug}`}>
                            {product.name}
                          </Link>
                          <button
                            className="cartitem__remove"
                            aria-label={`Remover ${product.name}`}
                            onClick={() =>
                              transact((state) => {
                                const cart = state.cart.filter((line) => itemKey(line) !== key);
                                return { ...state, cart, cardMessage: cart.length ? state.cardMessage : '' };
                              })
                            }
                          >
                            <Icon name="close" />
                          </button>
                        </div>

                        {item.variantTitle && (
                          <p
                            className="small"
                            style={{ margin: '2px 0 4px', color: 'var(--accent)', fontWeight: 600 }}
                          >
                            Opção: {item.variantTitle}
                          </p>
                        )}

                        <p className="cartitem__unit">{money(unitPrice)} / unidade</p>

                        {item.message && <p className="small muted">Dedicatória: “{item.message}”</p>}

                        <div className="cartitem__row">
                          <div className="qty" aria-label={`Quantidade de ${product.name}`}>
                            <button
                              aria-label={`Diminuir quantidade de ${product.name}`}
                              disabled={item.quantity === 1}
                              onClick={() =>
                                transact((state) => ({
                                  ...state,
                                  cart: changeQuantity(state.cart, key, item.quantity - 1),
                                }))
                              }
                            >
                              −
                            </button>
                            <span className="qty__n">{item.quantity}</span>
                            <button
                              aria-label={`Aumentar quantidade de ${product.name}`}
                              disabled={item.quantity === 99}
                              onClick={() =>
                                transact((state) => ({
                                  ...state,
                                  cart: changeQuantity(state.cart, key, item.quantity + 1),
                                }))
                              }
                            >
                              +
                            </button>
                          </div>
                          <strong className="cartitem__total">{money(unitPrice * item.quantity)}</strong>
                        </div>
                      </div>
                    </article>
                  );
                })}

                <Link className="cart-continue" to="/">
                  ← Continuar escolhendo decorações
                </Link>
              </section>

              <aside className="card card--elevated cart-summary">
                <h2>Resumo do pedido</h2>
                <Totals items={validCartItems} coupon={data.coupon} />
                <button
                  className="btn btn--action btn--block btn--pill"
                  type="button"
                  onClick={() => navigate('/checkout')}
                >
                  Finalizar pedido <Icon name="chevron" />
                </button>
                <p className="cart-summary__note">PIX ou cartão · compra 100% segura</p>
              </aside>
            </div>
          </>
        )}
      </main>
    </PageFrame>
  );
}
