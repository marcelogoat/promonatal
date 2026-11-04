import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui';
import { money, products } from '@/domain/catalog';
import { decodeStore, emptyStore, STORAGE_KEY, type StoreData } from '@/domain/storage';

type Store = { data: StoreData; transact: (update: (state: StoreData) => StoreData) => boolean; notify: (message: string) => void; showAdded: (productId: number) => void };
const StoreContext = createContext<Store | null>(null);
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Ocorreu um erro inesperado.';

function loadStore(): { data: StoreData; error: string } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return { data: saved === null ? emptyStore() : decodeStore(saved), error: '' };
  } catch (error) {
    return { data: emptyStore(), error: errorMessage(error) };
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [loaded] = useState(loadStore);
  const [data, setData] = useState(loaded.data);
  const [fatal, setFatal] = useState(loaded.error);
  const [toast, setToast] = useState('');
  const [addedProductId, setAddedProductId] = useState<number | null>(null);
  const notify = useCallback((message: string) => setToast(message), []);
  const showAdded = useCallback((productId: number) => setAddedProductId(productId), []);
  const addedProduct = addedProductId === null ? null : products.find((product) => product.id === addedProductId) ?? null;
  useEffect(() => {
    if (!addedProduct) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAddedProductId(null);
    };
    document.body.classList.add('addcart-open');
    window.addEventListener('keydown', close);
    return () => {
      document.body.classList.remove('addcart-open');
      window.removeEventListener('keydown', close);
    };
  }, [addedProduct]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      const next = loadStore();
      if (next.error) setFatal(next.error);
      else setData(next.data);
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const transact = useCallback((update: (state: StoreData) => StoreData) => {
    try {
      const current = loadStore();
      if (current.error) throw new Error(current.error);
      const next = decodeStore(JSON.stringify(update(current.data)));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setData(next);
      return true;
    } catch (error) { notify(errorMessage(error)); return false; }
  }, [notify]);
  if (fatal) return <main className="container recovery"><h1>Não foi possível abrir seus dados locais</h1><p role="alert">{fatal}</p><p>Nenhum dado foi sobrescrito. Você pode limpar explicitamente a demonstração para recomeçar.</p><button className="btn btn--primary" onClick={() => {
    try { localStorage.removeItem(STORAGE_KEY); setData(emptyStore()); setFatal(''); } catch (error) { setFatal(errorMessage(error)); }
  }}>Limpar demonstração local</button></main>;
  return <StoreContext.Provider value={{ data, transact, notify, showAdded }}>{children}<div className={`toast${toast ? ' is-visible' : ''}`} role="status" aria-live="polite">{toast}</div>{addedProduct && <div className="addcart-modal" role="dialog" aria-modal="true" aria-labelledby="addcart-title"><button className="addcart-modal__overlay" type="button" aria-label="Fechar" onClick={() => setAddedProductId(null)} /><section className="addcart-modal__card"><button className="addcart-modal__x" type="button" aria-label="Fechar" onClick={() => setAddedProductId(null)}><Icon name="close" /></button><div className="addcart-modal__head" id="addcart-title"><span className="addcart-modal__check"><Icon name="check" /></span>Produto selecionado</div><div className="addcart-modal__item"><img src={addedProduct.image} alt="" width={56} height={56} /><div><p className="addcart-modal__name">{addedProduct.name}</p><p className="addcart-modal__price">{money(addedProduct.price_cents)}</p></div></div><div className="addcart-modal__actions"><Link className="btn btn--action btn--block" to="/checkout" onClick={() => setAddedProductId(null)}>Finalizar compra</Link><button className="btn btn--soft btn--block" type="button" onClick={() => setAddedProductId(null)}>Continuar comprando</button></div></section></div>}</StoreContext.Provider>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('A loja deve estar dentro de StoreProvider.');
  return store;
}
