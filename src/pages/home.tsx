import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { categories, filterProducts, products } from '@/domain/catalog';
import { Icon, PageFrame, type IconName } from '@/components/ui';
import { ProductCard } from '@/components/product-card';
import css from '@/styles/pages/home.css?inline';

const heroBanners = [
  {
    id: 'b1',
    src: '/cdn/banners/banner-1.jpg',
    fallback: 'https://cdn.awsli.com.br/1920x1920/1772/1772186/banner/chatgpt-image-10-de-abr-de-2026-11_01_24-recuperado-2h1b5tjjau.jpg',
    alt: 'Especial Encanto Natalino - Decoração de Natal',
  },
  {
    id: 'b2',
    src: '/cdn/banners/banner-2.jpg',
    fallback: 'https://cdn.awsli.com.br/1920x1920/1772/1772186/banner/aaaaaa-w6qwhxjj35.jpg',
    alt: 'Árvores de Natal e Enfeites Festivos com Frete Grátis',
  },
  {
    id: 'b3',
    src: '/cdn/banners/banner-3.jpg',
    fallback: 'https://cdn.awsli.com.br/1920x1920/1772/1772186/banner/ccccccccccccccc-gaunr7ygfr.jpg',
    alt: 'Coleção Exclusiva de Natal - Encanto Natalino',
  },
];

const tiles: { category: string; label: string; icon: IconName }[] = [
  { category: 'Árvores de Natal', label: 'Árvores', icon: 'tree' },
  { category: 'Guirlandas & Enfeites', label: 'Enfeites', icon: 'sparkles' },
  { category: 'Luzes & Pisca-Pisca', label: 'Luzes', icon: 'lights' },
  { category: 'Presépios & Bonecos', label: 'Presépios', icon: 'bell' },
  { category: 'Kits & Presentes', label: 'Presentes', icon: 'gift' },
  { category: '__promo', label: 'Ofertas', icon: 'receipt' },
];

const occasionChips = [
  ['Ceia de Natal', '🎄 Ceia de Natal'],
  ['Decoração Completa', '✨ Decoração'],
  ['Presentear', '🎁 Presentes'],
  ['Mesa Posta', '🕯️ Mesa Posta'],
];

export function HomePage() {
  const [params, setParams] = useSearchParams();
  const [visible, setVisible] = useState(24);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const category = params.get('cat') ?? '';
  const occasion = params.get('ocasiao') ?? '';
  const query = params.get('q') ?? '';
  const sort = params.get('sort') ?? '';
  const promotion = params.get('promo') === '1';
  const result = useMemo(() => filterProducts({ category, occasion, query, sort, promotion }), [category, occasion, query, sort, promotion]);
  const filtered = Boolean(category || occasion || query || promotion);
  const christmasTrees = products.filter((product) => product.category === 'Árvores de Natal' && !product.sold_out);

  // Auto-advance banner carousel smoothly every 4.5s
  useEffect(() => {
    if (isHovered) return;
    const timer = setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % heroBanners.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [isHovered]);

  const nextBanner = () => setBannerIndex((prev) => (prev + 1) % heroBanners.length);
  const prevBanner = () => setBannerIndex((prev) => (prev - 1 + heroBanners.length) % heroBanners.length);

  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (['cat', 'ocasiao', 'promo'].includes(key)) {
      next.delete('cat');
      next.delete('ocasiao');
      next.delete('promo');
    }
    if (value) next.set(key, value);
    else next.delete(key);
    setVisible(24);
    setParams(next, { replace: true, preventScrollReset: true });
  }

  const groups = !filtered && !sort
    ? categories
        .map((name) => ({ name, items: result.slice(0, visible).filter((product) => product.category === name) }))
        .filter((group) => group.items.length)
    : [{ name: '', items: result.slice(0, visible) }];

  return (
    <PageFrame name="home" css={css}>
      {/* Banner Carousel Slider */}
      <section
        className="container"
        aria-label="Banners em destaque"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onTouchStart={() => setIsHovered(true)}
        onTouchEnd={() => setIsHovered(false)}
      >
        <div className="banner-carousel">
          <div className="banner-carousel__track">
            {heroBanners.map((banner, index) => (
              <div
                key={banner.id}
                className={`banner-carousel__slide${index === bannerIndex ? ' is-active' : ''}`}
                aria-hidden={index !== bannerIndex}
              >
                <img
                  className="banner-carousel__img"
                  src={banner.src}
                  alt={banner.alt}
                  width={1920}
                  height={642}
                  loading={index === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                  onError={(e) => {
                    if (e.currentTarget.src !== banner.fallback) {
                      e.currentTarget.src = banner.fallback;
                    }
                  }}
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            className="banner-carousel__nav banner-carousel__nav--prev"
            aria-label="Banner anterior"
            onClick={prevBanner}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <button
            type="button"
            className="banner-carousel__nav banner-carousel__nav--next"
            aria-label="Próximo banner"
            onClick={nextBanner}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          <div className="banner-carousel__dots" role="tablist" aria-label="Navegar entre banners">
            {heroBanners.map((banner, index) => (
              <button
                key={banner.id}
                type="button"
                className={`banner-carousel__dot${index === bannerIndex ? ' is-active' : ''}`}
                aria-label={`Ir para banner ${index + 1}`}
                aria-selected={index === bannerIndex}
                role="tab"
                onClick={() => setBannerIndex(index)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="container" aria-label="Categorias em destaque">
        <div className="catmenu">
          {tiles.map((tile) => (
            <button
              key={tile.category}
              type="button"
              className={`catmenu__item${tile.category === '__promo' ? ' catmenu__item--dark' : ''}${category === tile.category ? ' is-active' : ''}`}
              onClick={() => {
                update(tile.category === '__promo' ? 'promo' : 'cat', tile.category === '__promo' ? '1' : tile.category);
                document.getElementById('catalogo')?.scrollIntoView();
              }}
            >
              <span className="catmenu__icon">
                <Icon name={tile.icon} />
              </span>
              {tile.label}
            </button>
          ))}
        </div>
      </section>

      <section className="container" aria-label="Garantia Encanto Natalino">
        <div className="fresh">
          <Icon name="check" />
          <div>
            <strong>Garantia Encanto Natalino</strong>
            <span>Pinheiros selecionados com folhagem realista e decorações de alto padrão para todo o Brasil.</span>
          </div>
        </div>
      </section>

      <section className="container occasions" aria-label="Compre por ocasião">
        <h2>O que você procura?</h2>
        <div className="chips">
          {occasionChips.map(([value, label]) => (
            <button
              key={value}
              className={`chip${occasion === value ? ' is-active' : ''}`}
              aria-pressed={occasion === value}
              onClick={() => update('ocasiao', occasion === value ? '' : value)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {!filtered && (
        <section className="container rail-sec" aria-labelledby="rail-title">
          <div className="rail__head">
            <h2 id="rail-title" className="rail__title">Árvores de Natal</h2>
            <a className="rail__link" href="#catalogo" onClick={() => update('cat', 'Árvores de Natal')}>
              Ver todas
            </a>
          </div>
          <div className="rail__track">
            {christmasTrees.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      <section className="toolbar container" id="catalogo" aria-label="Buscar e filtrar decorações">
        <div className="toolbar__row">
          <label className="searchbox" htmlFor="busca">
            <span className="sr-only">Buscar decorações natalinas</span>
            <Icon name="search" />
            <input
              id="busca"
              type="search"
              placeholder="Buscar árvores de natal, guirlandas, luzes..."
              value={query}
              onChange={(event) => update('q', event.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="sr-only" htmlFor="ordenar">
            Ordenar por
          </label>
          <select id="ordenar" value={sort} onChange={(event) => update('sort', event.target.value)}>
            <option value="">Em destaque</option>
            <option value="price-asc">Menor preço</option>
            <option value="price-desc">Maior preço</option>
            <option value="name">Nome: A–Z</option>
          </select>
        </div>
        <div className="chips" aria-label="Categorias">
          {['', ...categories].map((value) => (
            <button
              key={value}
              className={`chip${category === value && !occasion && !promotion ? ' is-active' : ''}`}
              aria-pressed={category === value && !occasion && !promotion}
              onClick={() => update('cat', category === value ? '' : value)}
            >
              {value || 'Todas'}
            </button>
          ))}
        </div>
      </section>

      <main className="container" aria-label="Catálogo de Natal">
        <div className="catalog-head">
          <h2 className="title-serif">
            {query ? `Resultados para “${query}”` : category || occasion || (promotion ? 'Ofertas de Natal' : 'Especial de Natal')}
          </h2>
          <p className="muted" aria-live="polite">
            {result.length} {result.length === 1 ? 'produto' : 'produtos'}
          </p>
        </div>
        {!result.length ? (
          <div className="empty-state stack">
            <Icon name="search" />
            <h3>Nenhum item natalino encontrado</h3>
            <p className="muted">Tente outro termo ou escolha uma categoria.</p>
            <button
              className="btn btn--soft"
              onClick={() => {
                setParams({});
                setVisible(24);
              }}
            >
              Limpar filtros
            </button>
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.name} className="catalog-group">
              {group.name && <h3 className="category-heading">{group.name}</h3>}
              <div className="pgrid">
                {group.items.map((product, index) => (
                  <ProductCard key={product.id} product={product} eager={index < 4} />
                ))}
              </div>
            </section>
          ))
        )}
        {result.length > visible && (
          <div className="load-more">
            <button className="btn btn--ghost" onClick={() => setVisible((count) => count + 24)}>
              Mostrar mais itens ({result.length - visible})
            </button>
          </div>
        )}
      </main>
    </PageFrame>
  );
}
