import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { products, money } from '@/domain/catalog';
import { addItem } from '@/domain/commerce';
import { useStore } from '@/store';
import { EmptyState, Icon, PageFrame } from '@/components/ui';
import { ProductCard } from '@/components/product-card';
import css from '@/styles/pages/produto.css?inline';

export function ProductPage() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const [params] = useSearchParams();
  const id = params.get('id');
  const product = slug
    ? products.find((item) => item.slug === slug)
    : id && /^\d+$/.test(id)
    ? products.find((item) => item.id === Number(id))
    : undefined;

  const message = '';
  const [added, setAdded] = useState(false);
  const [activeImg, setActiveImg] = useState(0);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const { transact } = useStore();

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  useEffect(() => {
    // Start with NO option pre-selected so the user must choose
    setSelectedOptions({});
    setShowOptionsModal(false);
    setActiveImg(0);
    setAdded(false);
  }, [product?.id]);

  if (!product) {
    return (
      <EmptyState
        title="Produto não encontrado"
        text="Este item não faz parte do catálogo. Conheça nossas decorações natalinas."
      />
    );
  }

  const related = products
    .filter((item) => item.category === product.category && item.id !== product.id)
    .slice(0, 8);
  const extras = products
    .filter(
      (item) =>
        ['Guirlandas & Enfeites', 'Luzes & Pisca-Pisca'].includes(item.category) &&
        !item.sold_out &&
        item.id !== product.id
    )
    .slice(0, 4);

  const gallery = product.images && product.images.length > 0 ? product.images : [product.image];

  const hasOptions = Boolean(product.options && product.options.length > 0);
  const unselectedOptions = hasOptions
    ? product.options!.filter((opt) => !selectedOptions[opt.name])
    : [];
  const allOptionsSelected = !hasOptions || unselectedOptions.length === 0;

  // Matched variant based on selected options (only when all options are selected)
  const currentVariant = allOptionsSelected
    ? product.variants?.find((v) => {
        if (!product.options) return false;
        const opt1Name = product.options[0]?.name;
        const opt2Name = product.options[1]?.name;
        const opt3Name = product.options[2]?.name;

        if (opt1Name && v.option1 && selectedOptions[opt1Name] !== v.option1) return false;
        if (opt2Name && v.option2 && selectedOptions[opt2Name] !== v.option2) return false;
        if (opt3Name && v.option3 && selectedOptions[opt3Name] !== v.option3) return false;
        return true;
      })
    : undefined;

  const currentPrice = currentVariant ? currentVariant.price_cents : product.price_cents;
  const currentOldPrice = currentVariant ? currentVariant.old_price_cents : product.old_price_cents;
  const isAvailable = hasOptions
    ? allOptionsSelected
      ? currentVariant
        ? currentVariant.available !== false
        : false
      : true // Keep page active so user can select options
    : !product.sold_out;

  function handleSelectOption(optName: string, val: string) {
    setSelectedOptions((prev) => ({
      ...prev,
      [optName]: val,
    }));
    setAdded(false);
  }

  function buy() {
    if (!product) return;

    if (hasOptions && (!allOptionsSelected || !currentVariant)) {
      setShowOptionsModal(true);
      return;
    }

    setShowOptionsModal(false);
    if (
      transact((state) => ({
        ...state,
        cart: addItem(
          state.cart,
          product.id,
          1,
          message,
          currentVariant?.id,
          currentVariant?.title,
          currentPrice
        ),
      }))
    ) {
      navigate('/checkout');
    }
  }

  const ratingScore = product.rating || 4.9;
  const reviewsCount = product.reviews_count || 48;
  const reviewsList = product.reviews || [];

  return (
    <PageFrame name="produto" css={css}>
      <main className="container product-page">
        <nav className="crumbs" aria-label="Você está aqui">
          <Link to="/">Início</Link>
          <span className="crumbs__sep">›</span>
          <Link to={`/?cat=${encodeURIComponent(product.category)}`}>{product.category}</Link>
          <span className="crumbs__sep">›</span>
          <span className="crumbs__here" aria-current="page">
            {product.name}
          </span>
        </nav>

        <section className="pdp">
          <figure className="pdp__media">
            <img
              src={gallery[activeImg] || product.image}
              alt={product.name}
              width={800}
              height={1000}
              fetchPriority="high"
            />
            {product.sold_out && <span className="pitem__tag">Esgotado</span>}
            {gallery.length > 1 && (
              <div className="pdp__thumbs">
                {gallery.map((src, i) => (
                  <button
                    key={i}
                    className={`pdp__thumb${i === activeImg ? ' is-active' : ''}`}
                    onClick={() => setActiveImg(i)}
                    aria-label={`Imagem ${i + 1}`}
                  >
                    <img src={src} alt="" width={80} height={100} loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </figure>

          <div className="pdp__info">
            <div className="pdp__head">
              <p className="pdp__category">{product.category}</p>
              <h1 className="pdp__name title-serif">{product.name}</h1>
              <div className="pdp__rating">
                <span className="pdp__stars">★★★★★</span>
                <strong>{ratingScore.toFixed(1)}</strong>
                <a href="#avaliacoes" className="pdp__revlink">
                  ({reviewsCount} avaliações)
                </a>
                <span className="pdp__trust-badge">✓ 99% recomendam</span>
              </div>
            </div>

            <div>
              {hasOptions && !allOptionsSelected ? (
                <div>
                  <div className="pdp__prices">
                    <span className="price--lg">
                      <small style={{ fontSize: '15px', fontWeight: 600, color: 'var(--muted)', marginRight: '6px' }}>
                        A partir de
                      </small>
                      {money(product.price_cents)}
                    </span>
                  </div>
                  <p className="pdp__pix" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                    Selecione as opções abaixo para ver o valor final
                  </p>
                </div>
              ) : (
                <div>
                  <div className="pdp__prices">
                    <span className="price--lg">{money(currentPrice)}</span>
                    {currentOldPrice && currentOldPrice > currentPrice && (
                      <span className="pitem__old">{money(currentOldPrice)}</span>
                    )}
                  </div>
                  <p className="pdp__pix">
                    Pagamento via <strong>PIX</strong> ou Cartão
                  </p>
                </div>
              )}
            </div>

            {hasOptions && allOptionsSelected && !isAvailable ? (
              <div className="pdp__soldout">
                <strong>Configuração temporariamente indisponível.</strong> Escolha outra variação abaixo.
              </div>
            ) : (
              <>
                <div className="express-note">
                  <span className="express-note__icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="1" y="3" width="15" height="13" rx="2" />
                      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                      <circle cx="5.5" cy="18.5" r="2.5" />
                      <circle cx="18.5" cy="18.5" r="2.5" />
                    </svg>
                  </span>
                  <div>
                    <strong>Frete Grátis Brasil</strong>
                    <p>Entrega ágil e segura com rastreio total para o seu Natal.</p>
                  </div>
                </div>

                {hasOptions ? (
                  <div className="pdp__options">
                    {product.options!.map((opt) => {
                      const isChosen = Boolean(selectedOptions[opt.name]);
                      return (
                        <div key={opt.name} className="pdp__option-group">
                          <label className="pdp__option-title">
                            {opt.name}:{' '}
                            <span style={!isChosen ? { color: 'var(--muted)', fontWeight: 500, fontStyle: 'italic' } : {}}>
                              {selectedOptions[opt.name] || 'Escolha uma opção'}
                            </span>
                          </label>
                          <div className="pdp__option-pills">
                            {opt.values.map((val) => {
                              const isSelected = selectedOptions[opt.name] === val;
                              return (
                                <button
                                  type="button"
                                  key={val}
                                  className={`pdp__pill${isSelected ? ' is-active' : ''}`}
                                  onClick={() => handleSelectOption(opt.name, val)}
                                >
                                  {val}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div>
                    <h2 className="pdp__label">Tamanho</h2>
                    <div className="sizes">
                      <span className="size is-active">Único · {money(currentPrice)}</span>
                    </div>
                  </div>
                )}



                {added && (
                  <p className="pdp__feedback" role="status">
                    <Icon name="check" />
                    Adicionado com sucesso! <Link to="/checkout">Ir para o checkout</Link>
                  </p>
                )}

                <div className="buybar">
                  <div className="buybar__total">
                    <small>{allOptionsSelected ? 'Total' : 'A partir de'}</small>
                    <strong>{money(currentPrice)}</strong>
                  </div>
                  <button
                    className="btn btn--action buybar__btn"
                    onClick={buy}
                    style={
                      hasOptions && !allOptionsSelected
                        ? { background: 'var(--accent)', opacity: 0.9 }
                        : undefined
                    }
                  >
                    <Icon name="bag" />
                    {hasOptions && !allOptionsSelected ? 'Selecione as opções' : 'Comprar Agora'}
                  </button>
                </div>
              </>
            )}

            <ul className="pdp__trust">
              <li>
                <Icon name="check" />
                <span>
                  <strong>Qualidade &amp; Realismo de Alto Padrão</strong>
                  <br />
                  Galhos encorpados e duráveis para transformar seu ambiente.
                </span>
              </li>
              <li>
                <Icon name="gift" />
                <span>
                  <strong>Acompanha Acessórios</strong>
                  <br />
                  Bolsa protetora reforçada e luvas especiais de montagem.
                </span>
              </li>
              <li>
                <Icon name="moto" />
                <span>
                  <strong>Envio Rastreado para Todo o Brasil</strong>
                  <br />
                  Entrega garantida com código de acompanhamento em tempo real.
                </span>
              </li>
            </ul>

            <section className="pdp__desc">
              <h2>Detalhes e Especificações</h2>
              {product.body_html ? (
                <div dangerouslySetInnerHTML={{ __html: product.body_html }} />
              ) : (
                <p>{product.description || product.desc}</p>
              )}
            </section>
          </div>
        </section>

        {/* Customer Reviews Section */}
        <section className="pdp__reviews" id="avaliacoes">
          <div className="reviews__header">
            <div>
              <h2 className="title-serif">Avaliações de Clientes</h2>
              <p className="muted">Depoimentos verificados de quem comprou e decorou com a Encanto Natalino</p>
            </div>
            <div className="reviews__score-box">
              <div className="reviews__big-score">{ratingScore.toFixed(1)}</div>
              <div>
                <div className="reviews__stars">★★★★★</div>
                <p className="small muted">{reviewsCount} avaliações reais</p>
              </div>
            </div>
          </div>

          <div className="reviews__list">
            {reviewsList.map((rev) => (
              <article key={rev.id} className="review-card">
                <div className="review-card__top">
                  <div className="review-card__author">
                    <span className="review-card__avatar">
                      {rev.author
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')}
                    </span>
                    <div>
                      <strong>{rev.author}</strong>
                      <small className="muted">{rev.city}</small>
                    </div>
                  </div>
                  <div className="review-card__meta">
                    <span className="review-card__badge">✓ Compra verificada</span>
                    <span className="review-card__date">{rev.date}</span>
                  </div>
                </div>
                <div className="review-card__stars">
                  {'★'.repeat(rev.rating)}
                  {'☆'.repeat(5 - rev.rating)}
                </div>
                <h3 className="review-card__title">{rev.title}</h3>
                <p className="review-card__comment">{rev.comment}</p>
              </article>
            ))}
          </div>
        </section>

        {!product.sold_out && (
          <section className="related">
            <div className="related__head">
              <h2 className="title-serif">Enfeites e Iluminação para sua Árvore</h2>
            </div>
            <div className="pgrid">
              {extras.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </section>
        )}

        <section className="related">
          <div className="related__head">
            <h2 className="title-serif">Outros Modelos de Árvores de Natal</h2>
          </div>
          <div className="pgrid">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      </main>

      {showOptionsModal && (
        <div className="addcart-modal" role="dialog" aria-modal="true" aria-labelledby="options-modal-title">
          <button
            className="addcart-modal__overlay"
            type="button"
            aria-label="Fechar"
            onClick={() => setShowOptionsModal(false)}
          />
          <section className="addcart-modal__card" style={{ maxWidth: '380px', textAlign: 'center', padding: '24px 20px' }}>
            <button
              className="addcart-modal__x"
              type="button"
              aria-label="Fechar"
              onClick={() => setShowOptionsModal(false)}
            >
              <Icon name="close" />
            </button>

            <div
              style={{
                width: '56px',
                height: '56px',
                margin: '0 auto 14px',
                background: '#fef3c7',
                color: '#d97706',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>

            <h2 id="options-modal-title" style={{ fontSize: '19px', fontWeight: 800, margin: '0 0 8px', color: '#0f172a' }}>
              Atenção!
            </h2>

            <p style={{ fontSize: '14px', color: '#475569', margin: '0 0 20px', lineHeight: 1.5 }}>
              Por favor, selecione as opções de{' '}
              <strong style={{ color: '#0f172a' }}>
                {unselectedOptions.map((o) => o.name).join(' e ') || 'tamanho e iluminação'}
              </strong>{' '}
              antes de continuar a compra.
            </p>

            <button
              type="button"
              className="btn btn--action btn--block"
              style={{ height: '46px', borderRadius: '12px', fontWeight: 700, fontSize: '14.5px' }}
              onClick={() => {
                setShowOptionsModal(false);
                document.querySelector('.pdp__options')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            >
              Entendi, vou escolher
            </button>
          </section>
        </div>
      )}
    </PageFrame>
  );
}
