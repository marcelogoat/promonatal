import { Component, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Shell } from '@/components/shell';
import { EmptyState } from '@/components/ui';
import { AccountPage } from '@/pages/account';
import { CartPage } from '@/pages/cart';
import { CheckoutPage } from '@/pages/checkout';
import { CollectionPage } from '@/pages/collection';
import { HomePage } from '@/pages/home';
import { InstitutionalPage, type InstitutionalPageName } from '@/pages/institutional';
import { ConfirmationPage, TrackingPage } from '@/pages/orders';
import { PaymentPage } from '@/pages/payment';
import { ProductPage } from '@/pages/product';
import { ContactPage, SupportPage } from '@/pages/support';
import { StoreProvider } from '@/store';

const titles: Record<string, string> = {
  '/': 'Flores frescas para presentear', '/produto': 'Seu presente', '/colecao': 'Coleção de flores', '/carrinho': 'Sua sacola', '/checkout': 'Finalizar pedido', '/pagamento': 'Pagamento PIX', '/cartao': 'Pagamento com cartão', '/obrigado': 'Seu pedido', '/acompanhar': 'Acompanhar pedido', '/conta': 'Minha conta', '/contato': 'Contato', '/atendimento': 'Atendimento', '/sobre': 'Sobre', '/como-funciona': 'Como funciona', '/faq': 'Perguntas frequentes', '/politica-privacidade': 'Política de Privacidade', '/termos': 'Termos de Uso', '/troca-devolucao': 'Troca e Devolução', '/politica-entrega': 'Política de Entrega', '/politica-cookies': 'Política de Cookies',
};
const institutionalPages: InstitutionalPageName[] = ['sobre', 'como-funciona', 'faq', 'politica-privacidade', 'termos', 'troca-devolucao', 'politica-entrega', 'politica-cookies'];

function LegacyRoute() {
  const location = useLocation();
  const pathname = location.pathname === '/index.html' ? '/' : location.pathname.replace(/\.html$/, '');
  if (pathname !== location.pathname) return <Navigate replace to={`${pathname}${location.search}${location.hash}`} />;
  return <main className="container"><EmptyState title="Esta página não floresceu por aqui" text="O endereço não foi encontrado. Volte ao catálogo para escolher suas flores." icon="rose" /></main>;
}
function OrderAlias() {
  const location = useLocation();
  return <Navigate replace to={`/acompanhar${location.search}${location.hash}`} />;
}
function StoreRoutes() {
  const location = useLocation();
  useEffect(() => {
    const path = `/${location.pathname.split('/')[1]}`;
    document.title = `${titles[path] ?? 'Página não encontrada'} · Encanto Natalino`;
  }, [location.pathname]);
  return <Routes><Route element={<Shell />}><Route index element={<HomePage />} /><Route path="produto" element={<ProductPage key={location.search} />} /><Route path="produto/:slug" element={<ProductPage key={location.pathname} />} /><Route path="colecao" element={<CollectionPage key={location.search} />} /><Route path="colecao/:slug" element={<CollectionPage key={location.pathname} />} /><Route path="carrinho" element={<CartPage />} /><Route path="checkout" element={<CheckoutPage />} /><Route path="pagamento" element={<PaymentPage key={location.search} />} /><Route path="cartao" element={<PaymentPage card key={location.search} />} /><Route path="obrigado" element={<ConfirmationPage />} /><Route path="acompanhar" element={<TrackingPage key={location.search} />} /><Route path="pedido" element={<OrderAlias />} /><Route path="conta" element={<AccountPage />} /><Route path="contato" element={<ContactPage />} /><Route path="atendimento" element={<SupportPage key={location.search} />} />{institutionalPages.map((page) => <Route key={page} path={page} element={<InstitutionalPage page={page} />} />)}<Route path="*" element={<LegacyRoute />} /></Route></Routes>;
}
class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="container recovery stack"><h1>Não foi possível abrir esta tela</h1><p role="alert">Ocorreu um erro na demonstração. Seus dados locais não foram apagados.</p><a className="btn btn--primary" href="/">Reabrir a loja</a></main>;
    return this.props.children;
  }
}
export function App() {
  return <AppErrorBoundary><BrowserRouter><StoreProvider><StoreRoutes /></StoreProvider></BrowserRouter></AppErrorBoundary>;
}
