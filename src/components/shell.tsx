import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { categories, occasions, products } from '@/domain/catalog';
import { trackFbPageView } from '@/domain/analytics';
import { useStore } from '@/store';
import { Brand, Icon, Modal, type IconName } from './ui';

const categoryIcons: IconName[] = ['tree', 'sparkles', 'lights', 'bell', 'star', 'gift', 'basket'];
export const institutionalLinks = [
  ['sobre', 'Sobre'], ['como-funciona', 'Como funciona'], ['faq', 'Perguntas frequentes'], ['politica-privacidade', 'Política de Privacidade'], ['termos', 'Termos de Uso'], ['troca-devolucao', 'Troca e Devolução'], ['politica-entrega', 'Política de Entrega'], ['politica-cookies', 'Cookies'], ['contato', 'Contato'], ['atendimento', 'Atendimento'],
];

const notices = [
  'Frete grátis para todo o Brasil',
  'Árvores de Natal e enfeites exclusivos',
  'Envio seguro com código de rastreamento',
  'Decorações mágicas para transformar seu lar'
];

export function Shell() {
  const { data } = useStore();
  const location = useLocation();
  const [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState(0);
  const [cookie, setCookie] = useState(false);
  const count = data.cart.reduce((total, item) => total + item.quantity, 0);
  const bare = /^\/(checkout|pagamento|cartao)(\.html)?$/.test(location.pathname);
  const isProduct = /^\/produto(\/.*)?$/.test(location.pathname);

  useEffect(() => {
    const timer = setInterval(() => setNotice((value) => (value + 1) % notices.length), 4500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    trackFbPageView();
  }, [location.pathname]);

  useEffect(() => {
    setMenu(false);
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => {
    if (location.hash) {
      const target = document.getElementById(location.hash.slice(1));
      target?.scrollIntoView();
      if (target instanceof HTMLInputElement) target.focus({ preventScroll: true });
    } else window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname, location.hash]);

  return (
    <>
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      <header className="topbar">
        {!bare && (
          <div className="notice">
            <Icon name="bolt" />
            <span>{notice === 0 ? <><em>Frete grátis</em> para todo o Brasil</> : notices[notice]}</span>
          </div>
        )}
        <div className="container topbar__row">
          <div className="topbar__left">
            <button className="topbar__menu" aria-label="Abrir menu de categorias" aria-expanded={menu} onClick={() => setMenu(true)}>
              <Icon name="menu" />
            </button>
            <Brand />
          </div>
          <div className="topbar__right">
            <Link className="topbar__cart" to="/conta" aria-label="Minha conta">
              <Icon name="user" />
            </Link>
            <Link className="topbar__cart" to="/carrinho" aria-label={`Abrir sacola, ${count} itens`}>
              <Icon name="bag" />
              {count > 0 && <span className="badge">{count}</span>}
            </Link>
          </div>
        </div>
      </header>

      <div id="conteudo" tabIndex={-1}><Outlet /></div>

      {!/^\/checkout(?:\.html)?$/.test(location.pathname) && (
        <footer className="site-footer">
          <div className="container">
            <Brand />
            <nav className="site-footer__links" aria-label="Institucional">
              {institutionalLinks.map(([path, label]) => (
                <Link key={path} to={`/${path}`}>{label}</Link>
              ))}
            </nav>
            <p className="site-footer__legal">
              Encanto Natalino – Sua loja de árvores e decorações de Natal com envio para todo o Brasil.<br />
              <button className="text-link" onClick={() => setCookie(true)}>Preferências de privacidade</button>
            </p>
          </div>
        </footer>
      )}

      {!isProduct && (
        <nav className="footer-nav" aria-label="Navegação principal">
          <NavLink to="/" end>
            <Icon name="home" />
            <span>Início</span>
          </NavLink>
          <Link to="/#busca">
            <Icon name="search" />
            <span>Buscar</span>
          </Link>
          <NavLink to="/carrinho">
            <Icon name="bag" />
            <span>Sacola{count ? ` (${count})` : ''}</span>
          </NavLink>
          <NavLink to="/acompanhar">
            <Icon name="receipt" />
            <span>Pedidos</span>
          </NavLink>
          <NavLink to="/contato">
            <Icon name="help" />
            <span>Ajuda</span>
          </NavLink>
        </nav>
      )}

      <Modal title="Categorias" open={menu} onClose={() => setMenu(false)} drawer>
        <div className="menu-intro">
          <span>O encanto de cada momento</span>
          <h3>Decorações de Natal</h3>
        </div>
        <div className="menu-list">
          {categories.map((category, index) => (
            <Link className="menu-list__item" key={category} to={`/?cat=${encodeURIComponent(category)}`} onClick={() => setMenu(false)}>
              <span className="menu-list__icon">
                <Icon name={categoryIcons[index % categoryIcons.length]} />
              </span>
              <span className="menu-list__label">{category}</span>
              <span className="menu-list__count">
                {products.filter((product) => product.categories.includes(category)).length}
              </span>
              <span className="menu-list__chev">
                <Icon name="chevron" />
              </span>
            </Link>
          ))}
        </div>
        <h3 className="menu-section-title">Por ocasião</h3>
        <div className="chips">
          {occasions.map((occasion) => (
            <Link className="chip" key={occasion} to={`/?ocasiao=${encodeURIComponent(occasion)}`} onClick={() => setMenu(false)}>
              {occasion}
            </Link>
          ))}
        </div>
        <div className="menu-extra">
          <Link to="/conta" onClick={() => setMenu(false)}>Minha conta</Link>
          <Link to="/acompanhar" onClick={() => setMenu(false)}>Acompanhar pedido</Link>
          <Link to="/atendimento" onClick={() => setMenu(false)}>Falar com atendimento</Link>
        </div>
      </Modal>

      <Modal title="Sua privacidade" open={cookie} onClose={() => setCookie(false)}>
        <div className="stack">
          <p>Esta versão usa armazenamento local para sua sacola, pedidos e preferências na loja Encanto Natalino.</p>
          <p>Não há cookies de rastreamento invasivo. Seus dados de envio são processados com segurança para entrega.</p>
          <Link className="text-link" to="/politica-cookies" onClick={() => setCookie(false)}>Ler a política de cookies</Link>
          <button className="btn btn--primary btn--block" onClick={() => setCookie(false)}>Entendi</button>
        </div>
      </Modal>
    </>
  );
}
