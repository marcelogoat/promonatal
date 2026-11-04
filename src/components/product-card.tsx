import { Link, useNavigate } from 'react-router-dom';
import { money, type Product } from '@/domain/catalog';
import { addItem } from '@/domain/commerce';
import { useStore } from '@/store';

export function ProductCard({ product, eager = false }: { product: Product; eager?: boolean }) {
  const navigate = useNavigate();
  const { transact } = useStore();
  const discount =
    product.old_price_cents && product.old_price_cents > product.price_cents
      ? Math.round((1 - product.price_cents / product.old_price_cents) * 100)
      : 0;
  const url = `/produto/${product.slug}`;
  const rating = product.rating || 4.9;
  const reviewCount = product.reviews_count || 38;

  return (
    <article className={`pitem${product.sold_out ? ' pitem--soldout' : ''}`}>
      <Link className="pitem__media" to={url} tabIndex={-1} aria-hidden="true">
        <img
          src={product.image}
          alt={product.name}
          width={400}
          height={500}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
        />
        {product.sold_out ? (
          <span className="pitem__tag">Esgotado</span>
        ) : (
          discount > 0 && <span className="pitem__tag">-{discount}%</span>
        )}
      </Link>
      <div className="pitem__body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p className="pitem__kicker">{product.category}</p>
          <div className="pitem__rating" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '12px' }}>
            <span style={{ color: '#f59e0b', fontSize: '12px' }}>★</span>
            <strong style={{ fontSize: '11.5px', color: 'var(--ink)' }}>{rating.toFixed(1)}</strong>
            <span style={{ color: 'var(--muted)', fontSize: '10.5px' }}>({reviewCount})</span>
          </div>
        </div>
        <Link className="pitem__name" to={url}>
          {product.name}
        </Link>
        <div className="pitem__buy">
          <div className="pitem__prices">
            {discount > 0 && (
              <span className="price price--old">{money(product.old_price_cents!)}</span>
            )}
            <span className="price">
              {product.options && product.options.length > 0 && (
                <small style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', marginRight: '3px' }}>
                  a partir de
                </small>
              )}
              {money(product.price_cents)}
            </span>
          </div>
          <button
            className="qadd"
            type="button"
            disabled={product.sold_out}
            aria-label={`Comprar ${product.name}`}
            onClick={() => {
              if (product.options && product.options.length > 0) {
                navigate(url);
              } else {
                if (transact((state) => ({ ...state, cart: addItem(state.cart, product.id) }))) {
                  navigate('/checkout');
                }
              }
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
}
