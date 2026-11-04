import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DemoNotice, Icon, PageFrame, type IconName } from '@/components/ui';
import { orderDate } from '@/components/order-summary';
import { useStore } from '@/store';
import css from '@/styles/pages/contato.css?raw';

const topics: { value: string; title: string; text: string; icon: IconName }[] = [
  { value: 'duvida', title: 'Meu pedido', text: 'Andamento, código de rastreamento ou entrega.', icon: 'bag' },
  { value: 'reembolso', title: 'Reembolso', text: 'Trocas, cancelamento e devoluções.', icon: 'receipt' },
  { value: 'privacidade', title: 'Privacidade', text: 'Seus direitos LGPD.', icon: 'doc' },
  { value: 'envio', title: 'Rastreamento & Envio', text: 'Dúvidas sobre envio ou prazos de entrega.', icon: 'moto' },
];

export function ContactPage() {
  return (
    <PageFrame name="contato" css={css}>
      <main className="container sac">
        <p className="sac__kicker">SAC • Atendimento</p>
        <h1 className="title-serif sac__title">Por aqui resolvemos</h1>
        <p className="sac__lead">Escolha um assunto abaixo para abrir um chamado. Nossa equipe responde rapidamente.</p>
        <section className="card card--elevated sac-card" aria-label="Atendimento demonstrativo">
          <Icon name="mail" />
          <span className="sac-card__email">Fale com a gente</span>
          <Link className="btn btn--action sac-card__btn" to="/atendimento?sem_pedido=1">Abrir atendimento</Link>
          <p className="sac-card__sla">Atendimento de segunda a sábado das 09h às 18h.</p>
        </section>
        <div className="sac-topics">
          {topics.map((topic) => (
            <Link className="card sac-topic" key={topic.value} to={`/atendimento?assunto=${topic.value}`}>
              <Icon name={topic.icon} />
              <h2>{topic.title}</h2>
              <p>{topic.text}</p>
            </Link>
          ))}
        </div>
      </main>
    </PageFrame>
  );
}

export function SupportPage() {
  const [params] = useSearchParams();
  const { data, transact, notify } = useStore();
  const requested = params.get('assunto');
  const [subject, setSubject] = useState(topics.some((topic) => topic.value === requested) ? requested! : '');
  const [email, setEmail] = useState(data.profile?.email ?? '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [created, setCreated] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!topics.some((topic) => topic.value === subject) || message.trim().length < 10) {
      setError('Selecione um assunto e escreva ao menos 10 caracteres.');
      return;
    }
    const id = `ticket_${crypto.randomUUID()}`;
    if (transact((state) => ({ ...state, tickets: [{ id, subject, email: email.trim(), message: message.trim(), createdAt: new Date().toISOString() }, ...state.tickets] }))) {
      setCreated(id);
      setMessage('');
      setError('');
      notify('Chamado demonstrativo salvo com sucesso.');
    }
  }

  return (
    <main className="container support-page stack">
      <header>
        <Link className="text-link small" to="/contato">‹ Central de ajuda</Link>
        <h1 className="title-serif">Como podemos ajudar?</h1>
        <p className="muted">Conte para a gente o que aconteceu.</p>
      </header>
      <DemoNotice>Atendimento da loja Encanto Natalino. Use e-mail para receber as notificações do seu pedido.</DemoNotice>
      {created && (
        <section className="panel success-panel stack" role="status">
          <Icon name="check" />
          <h2>Chamado registrado com sucesso!</h2>
          <p>Protocolo: <strong>#{created.slice(7, 15).toUpperCase()}</strong></p>
          <p>Seu chamado está disponível no histórico abaixo.</p>
          <button className="btn btn--soft" onClick={() => setCreated('')}>Abrir outro chamado</button>
        </section>
      )}
      <form className="panel stack" onSubmit={submit}>
        <label className="field" htmlFor="ticket-subject">
          Assunto
          <select id="ticket-subject" value={subject} onChange={(event) => setSubject(event.target.value)} required>
            <option value="">Selecione um assunto</option>
            {topics.map((topic) => <option value={topic.value} key={topic.value}>{topic.title}</option>)}
          </select>
        </label>
        <label className="field" htmlFor="ticket-email">
          E-mail
          <input id="ticket-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={200} required />
        </label>
        <label className="field" htmlFor="ticket-message">
          Sua mensagem
          <textarea id="ticket-message" value={message} onChange={(event) => setMessage(event.target.value)} rows={5} minLength={10} maxLength={2000} required />
          <span className="field__hint">{message.length}/2000 caracteres</span>
        </label>
        {error && <p className="field__error" role="alert">{error}</p>}
        <button className="btn btn--primary">Registrar chamado</button>
      </form>
      {data.tickets.length > 0 && (
        <section className="stack">
          <h2>Meus chamados</h2>
          {data.tickets.map((ticket) => (
            <details className="panel ticket" key={ticket.id}>
              <summary>
                <strong>#{ticket.id.slice(7, 15).toUpperCase()} • {topics.find((topic) => topic.value === ticket.subject)?.title ?? ticket.subject}</strong>
                <span className="small muted">{orderDate(ticket.createdAt)}</span>
              </summary>
              <p>{ticket.message}</p>
              <p className="small muted">{ticket.email}</p>
            </details>
          ))}
        </section>
      )}
    </main>
  );
}
