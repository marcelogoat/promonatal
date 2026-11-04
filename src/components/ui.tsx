import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import icons from '@/data/icons.json';
import { money } from '@/domain/catalog';
import { quote, type CartItem, type DeliveryMode } from '@/domain/commerce';

export type IconName = keyof typeof icons;
export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return <span className={`icon ${className}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: icons[name] }} />;
}
export function Brand({ className = '' }: { className?: string }) {
  return (
    <Link className={`brand ${className}`.trim()} to="/" aria-label="Encanto Natalino – início">
      <img
        className="brand__logo-img"
        src="/assets/logo.jpg"
        alt="Encanto Natalino"
        width={160}
        height={56}
        loading="eager"
        decoding="async"
      />
    </Link>
  );
}
export function Modal({ title, open, onClose, children, drawer = false, className = '', dismissible = true }: { title: string; open: boolean; onClose: () => void; children: ReactNode; drawer?: boolean; className?: string; dismissible?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const active = document.activeElement;
    dialog.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previous;
      if (active instanceof HTMLElement) active.focus();
    };
  }, [open]);
  return <dialog ref={ref} className={`modal${drawer ? ' modal--drawer' : ''}${className ? ` ${className}` : ''}`} aria-labelledby={titleId} onCancel={(event) => { if (dismissible) onClose(); else event.preventDefault(); }} onClick={(event) => { if (dismissible && event.target === ref.current) onClose(); }}><div className="modal__content"><div className="drawer__head"><h2 id={titleId}>{title}</h2>{dismissible && <button className="drawer__close" type="button" aria-label="Fechar" onClick={onClose}><Icon name="close" /></button>}</div><div className="drawer__body">{children}</div></div></dialog>;
}
export function EmptyState({ title, text, to = '/', label = 'Escolher decorações', icon = 'bag' }: { title: string; text: string; to?: string; label?: string; icon?: IconName }) {
  return <div className="empty-state stack"><Icon name={icon} /><h1>{title}</h1><p className="muted">{text}</p><Link className="btn btn--primary" to={to}>{label}</Link></div>;
}
export function Totals({ items, mode = 'padrao', coupon = '', extraCents = 0, extraLabel = 'Adicional' }: { items: CartItem[]; mode?: DeliveryMode; coupon?: string; extraCents?: number; extraLabel?: string }) {
  const totals = quote(items, mode, coupon, extraCents);
  return <div className="stack"><p className="summary__line"><span className="muted">Subtotal</span><span>{money(totals.subtotal)}</span></p>{totals.discount > 0 && <p className="summary__line"><span>Desconto</span><span className="summary__free">– {money(totals.discount)}</span></p>}{totals.extra > 0 && <p className="summary__line"><span>{extraLabel}</span><span>{money(totals.extra)}</span></p>}<p className="summary__line"><span className="muted">Entrega</span><span className="summary__free">{totals.shipping ? money(totals.shipping) : 'Grátis'}</span></p><hr className="hairline" /><p className="summary__line summary__total"><span>Total</span><strong>{money(totals.total)}</strong></p></div>;
}
export function DemoNotice({ children }: { children?: ReactNode }) {
  return <div className="demo-notice"><Icon name="doc" /><p>{children ?? 'Demonstração de front-end. Use dados fictícios. Nenhuma cobrança, entrega ou mensagem real será realizada.'}</p></div>;
}
export function PageFrame({ name, css = '', children }: { name: string; css?: string; children: ReactNode }) {
  return <div className={`page-${name}`}><style>{`@scope (.page-${name}) { ${css} }`}</style>{children}</div>;
}
