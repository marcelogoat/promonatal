import { useEffect, useRef, useState, type FormEvent, type HTMLInputTypeAttribute } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EmptyState, Icon, PageFrame, Totals } from '@/components/ui';
import { money, productById } from '@/domain/catalog';
import { changeQuantity, deliveryModes, itemKey, quote } from '@/domain/commerce';
import {
  emptyCheckout,
  formatCep,
  formatCpf,
  formatPhone,
  lookupCep,
  states,
  validateCheckout,
  type CheckoutData,
} from '@/domain/checkout';
import { createOrder, isDeliveryMode, safeRandomUUID } from '@/domain/storage';
import { createPix } from '@/domain/pix';
import { trackGoogleConversion } from '@/domain/analytics';
import { useStore } from '@/store';
import css from '@/styles/pages/checkout.css?raw';

const emailDomains = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com.br', 'icloud.com'];

export function CheckoutPage() {
  const { data, transact } = useStore();
  const navigate = useNavigate();
  const form = useRef<HTMLFormElement>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  // PIX only — cartão removed
  const [summaryOpen, setSummaryOpen] = useState(false);

  const [values, setValues] = useState<CheckoutData>({
    ...emptyCheckout,
    mensagem: data.cardMessage,
    nome: data.profile?.name ?? '',
    email: data.profile?.email ?? '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutData, string>>>({});
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [orderBump, setOrderBump] = useState(false);

  // Bump product: Kit 32 Enfeites Azul, Branco e Prata (ID 604)
  const bumpProduct = productById(604);
  const bumpPrice = 3290; // R$32,90 fixo

  const orderTotals = quote(data.cart, values.mode, data.coupon, orderBump ? bumpPrice : 0);

  const isAddressComplete = Boolean(
    values.cep.replace(/\D/g, '').length === 8 &&
    values.endereco.trim().length >= 2 &&
    values.numero.trim().length >= 1 &&
    values.bairro.trim().length >= 1 &&
    values.cidade.trim().length >= 2 &&
    values.estado.trim().length === 2
  );

  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_cepMessage, setCepMessage] = useState('Digite o CEP para buscar o endereço.');
  const [emailFocused, setEmailFocused] = useState(false);

  const identificationKeys: (keyof CheckoutData)[] = ['nome', 'telefone', 'email'];
  const addressKeys: (keyof CheckoutData)[] = [
    'cep',
    'endereco',
    'numero',
    'complemento',
    'bairro',
    'cidade',
    'estado',
    'mode',
  ];

  function change(key: keyof CheckoutData, value: string) {
    if (key === 'mode' && !isDeliveryMode(value)) return;
    const formatted =
      key === 'telefone'
        ? formatPhone(value)
        : key === 'cpf'
        ? formatCpf(value)
        : key === 'cep'
        ? formatCep(value)
        : value;

    setValues((current) => ({ ...current, [key]: formatted }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    if (key === 'mensagem') transact((state) => ({ ...state, cardMessage: formatted }));
  }

  function handleNumericKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (
      ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(
        event.key
      ) ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return;
    }
    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
    }
  }

  function field(
    key: keyof CheckoutData,
    label: string,
    type: HTMLInputTypeAttribute = 'text',
    optional = false,
    placeholder = ''
  ) {
    const isNumeric = key === 'telefone' || key === 'cpf' || key === 'cep';
    const maxLength = key === 'telefone' ? 15 : key === 'cpf' ? 14 : key === 'cep' ? 9 : 200;
    const inputType = isNumeric ? 'tel' : type;

    return (
      <div className="field">
        <label htmlFor={key}>
          {label}
          {optional && <span className="muted">(opcional)</span>}
        </label>
        <input
          id={key}
          name={key}
          type={inputType}
          inputMode={isNumeric ? 'numeric' : undefined}
          pattern={isNumeric ? '[0-9]*' : undefined}
          placeholder={placeholder}
          value={values[key]}
          onKeyDown={isNumeric ? handleNumericKeyDown : undefined}
          onChange={(event) => change(key, event.target.value)}
          required={!optional}
          maxLength={maxLength}
          aria-invalid={Boolean(errors[key])}
          aria-describedby={errors[key] ? `${key}-error` : undefined}
        />
        {errors[key] && (
          <p className="field__error" id={`${key}-error`}>
            {errors[key]}
          </p>
        )}
      </div>
    );
  }

  // Auto CEP lookup via ViaCEP
  useEffect(() => {
    const cep = values.cep.replace(/\D/g, '');
    if (cep.length !== 8) {
      setCepStatus('idle');
      setCepMessage('Digite o CEP para buscar o endereço.');
      return;
    }
    const controller = new AbortController();
    setCepStatus('loading');
    setCepMessage('Buscando endereço…');
    void lookupCep(cep, controller.signal)
      .then((address) => {
        setValues((current) =>
          current.cep.replace(/\D/g, '') === cep ? { ...current, ...address } : current
        );
        setErrors((current) => ({
          ...current,
          cep: undefined,
          endereco: undefined,
          bairro: undefined,
          cidade: undefined,
          estado: undefined,
        }));
        setCepStatus('success');
        setCepMessage('Endereço preenchido!');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setCepStatus('error');
        setCepMessage('CEP não localizado. Preencha manualmente.');
      });
    return () => controller.abort();
  }, [values.cep]);

  const [emailUser = '', emailDomain = ''] = values.email.split('@');
  const emailSuggestions =
    values.email.includes('@') && emailUser
      ? emailDomains
          .filter((domain) => domain.startsWith(emailDomain.toLowerCase()))
          .map((domain) => `${emailUser}@${domain}`)
      : [];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (paymentLoading) return;
    setPaymentError('');

    // Ensure recebedor is filled
    if (!values.recebedor || !values.recebedor.trim()) {
      values.recebedor = values.nome.trim();
    }

    const validation = validateCheckout(values);

    // Step 1 validation
    if (step === 1) {
      const stepErrors = Object.fromEntries(
        Object.entries(validation).filter(([key]) => identificationKeys.includes(key as keyof CheckoutData))
      ) as Partial<Record<keyof CheckoutData, string>>;
      setErrors(stepErrors);
      const first = Object.keys(stepErrors)[0];
      if (first) {
        form.current?.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${first}"]`)?.focus();
        return;
      }
      setErrors({});
      setStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Step 2 validation
    if (step === 2) {
      const stepErrors = Object.fromEntries(
        Object.entries(validation).filter(([key]) => addressKeys.includes(key as keyof CheckoutData))
      ) as Partial<Record<keyof CheckoutData, string>>;
      setErrors(stepErrors);
      const first = Object.keys(stepErrors)[0];
      if (first) {
        form.current?.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${first}"]`)?.focus();
        return;
      }
      setErrors({});
      setStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Step 3 final submit
    setErrors(validation);
    const first = Object.keys(validation)[0];
    if (first) {
      form.current?.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${first}"]`)?.focus();
      return;
    }

    const id = `natal_${safeRandomUUID()}`;
    const cart = data.cart.map((item) => ({ ...item }));
    const coupon = data.coupon;
    setPaymentLoading(true);

    try {
      const bump = orderBump && bumpProduct ? { productId: bumpProduct.id, priceCents: bumpPrice } : null;
      const pix = await createPix(id, cart, coupon, values, bump?.priceCents ?? 0);
      const order = createOrder(values, cart, coupon, bump, id, pix);

      // Track conversion immediately upon PIX generation
      try {
        const orderTotal = quote(cart, values.mode, coupon, bump?.priceCents ?? 0).total;
        trackGoogleConversion(orderTotal, id);
        sessionStorage.setItem(`gads_conv_${id}`, '1');
      } catch (err) {
        console.warn('[Google Ads] falha ao registrar conversão no checkout:', err);
      }

      if (
        transact((state) => ({
          ...state,
          orders: [order, ...state.orders],
          cart: [],
          coupon: '',
          cardMessage: '',
        }))
      ) {
        navigate(`/pagamento?id=${encodeURIComponent(id)}`);
      }
    } catch (error) {
      setPaymentError(
        error instanceof Error ? error.message : 'Não foi possível gerar o pedido. Tente novamente.'
      );
    } finally {
      setPaymentLoading(false);
    }
  }

  function goBack() {
    if (step === 3) {
      setStep(2);
    } else if (step === 2) {
      setStep(1);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (!data.cart.length) {
    return (
      <main className="container empty-cart">
        <EmptyState
          title="Sua sacola está vazia"
          text="Escolha suas árvores e decorações antes de finalizar o pedido."
          to="/"
          label="Explorar produtos de Natal"
        />
      </main>
    );
  }

  const actionLabel =
    step === 1
      ? 'Ir para entrega →'
      : step === 2
      ? 'Ir para pagamento →'
      : 'Finalizar Compra via PIX';

  return (
    <PageFrame name="checkout" css={css}>
      <main className="container checkout">
        {/* BARRA SUPERIOR: VOLTAR + SELO DE SEGURANÇA */}
        <header className="checkout-topbar">
          {step === 1 ? (
            <Link className="checkout__back" to="/">
              <span style={{ transform: 'rotate(180deg)', display: 'inline-block' }}>➜</span> Continuar comprando
            </Link>
          ) : (
            <button className="checkout__back" type="button" onClick={goBack}>
              <span style={{ transform: 'rotate(180deg)', display: 'inline-block' }}>➜</span> Voltar para etapa {step - 1}
            </button>
          )}

          <div className="checkout-trust-badge">
            <Icon name="lock" />
            <span>Ambiente 100% Criptografado & Seguro</span>
          </div>
        </header>

        {/* RESUMO DA COMPRA NO TOPO: RETRÁTIL / ACCORDION */}
        <section className={`checkout-summary-accordion ${summaryOpen ? 'is-open' : ''}`} aria-label="Resumo do pedido">
          <button
            type="button"
            className="summary-accordion-header"
            onClick={() => setSummaryOpen((prev) => !prev)}
            aria-expanded={summaryOpen}
          >
            <div className="summary-accordion-left">
              <Icon name="bag" />
              <span className="summary-accordion-title">
                {summaryOpen ? 'Ocultar resumo da compra' : 'Resumo da compra'}
              </span>
              <span className={`summary-accordion-chevron ${summaryOpen ? 'is-rotated' : ''}`}>
                <Icon name="chevron" />
              </span>
            </div>
            <strong className="summary-accordion-total">
              {money(orderTotals.total)}
            </strong>
          </button>

          {summaryOpen && (
            <div className="summary-accordion-body">
              <div className="summary__items">
                {data.cart.map((item) => {
                  const product = productById(item.productId);
                  const unitPrice = item.priceCents ?? product.price_cents;
                  const key = itemKey(item);
                  return (
                    <div className="sitem" key={key}>
                      <div className="sitem__img-wrap">
                        <img className="sitem__img" src={product.image} alt={product.name} />
                      </div>
                      <div className="sitem__details">
                        <p className="sitem__name">{product.name}</p>
                        {item.variantTitle && (
                          <span className="sitem__variant">{item.variantTitle}</span>
                        )}
                        <div className="sitem__qty-row">
                          <div className="sitem__qty-stepper">
                            <button
                              type="button"
                              className="sitem__qty-btn"
                              aria-label="Diminuir ou remover item"
                              onClick={() => {
                                if (item.quantity <= 1) {
                                  transact((state) => ({
                                    ...state,
                                    cart: state.cart.filter((line) => itemKey(line) !== key),
                                  }));
                                } else {
                                  transact((state) => ({
                                    ...state,
                                    cart: changeQuantity(state.cart, key, item.quantity - 1),
                                  }));
                                }
                              }}
                            >
                              −
                            </button>
                            <span className="sitem__qty-val">{item.quantity}</span>
                            <button
                              type="button"
                              className="sitem__qty-btn"
                              aria-label="Aumentar quantidade"
                              onClick={() => {
                                transact((state) => ({
                                  ...state,
                                  cart: changeQuantity(state.cart, key, item.quantity + 1),
                                }));
                              }}
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            className="sitem__remove-btn"
                            aria-label="Remover item"
                            onClick={() => {
                              transact((state) => ({
                                ...state,
                                cart: state.cart.filter((line) => itemKey(line) !== key),
                              }));
                            }}
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                      <strong className="sitem__price">{money(unitPrice * item.quantity)}</strong>
                    </div>
                  );
                })}
              </div>

              <hr className="hairline" />

              <Totals
                items={data.cart}
                mode={values.mode}
                coupon={data.coupon}
                extraCents={orderBump ? bumpPrice : 0}
                extraLabel="Kit 32 Enfeites (Oferta Especial)"
              />

              <div className="checkout-security-seals">
                <div className="seal-item">
                  <Icon name="lock" />
                  <span>Compra 100% Segura e Criptografada</span>
                </div>
                <div className="seal-item">
                  <Icon name="check" />
                  <span>Garantia de Entrega ou seu Dinheiro de Volta</span>
                </div>
                <div className="seal-item">
                  <Icon name="moto" />
                  <span>Código de Rastreamento pelo WhatsApp</span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* STEPPER: 3 ETAPAS */}
        <nav className="checkout-stepper" aria-label="Progresso da compra">
          {[
            { n: 1, label: '1. Identificação' },
            { n: 2, label: '2. Endereço & Frete' },
            { n: 3, label: '3. Pagamento' },
          ].map((item, idx) => (
            <div
              className={`step-item ${item.n === step ? 'is-current' : item.n < step ? 'is-completed' : ''}`}
              key={item.label}
            >
              <div className="step-item__circle">
                {item.n < step ? '✓' : item.n}
              </div>
              <span className="step-item__label">{item.label}</span>
              {idx < 2 && <div className="step-item__line" />}
            </div>
          ))}
        </nav>

        {/* FORMULÁRIO DO CHECKOUT */}
        <form id="checkout-form" ref={form} className="stack" onSubmit={submit} noValidate>
          {/* ETAPA 1: IDENTIFICAÇÃO */}
          {step === 1 && (
            <section className="panel step">
              <div className="step__head">
                <div className="step__title-wrap">
                  <span className="step__num">1</span>
                  <h2>Identificação do Comprador</h2>
                </div>
              </div>

              <div className="fields">
                {field('nome', 'Nome completo', 'text', false, 'Ex: Maria da Silva')}

                {field('telefone', 'Celular / WhatsApp com DDD', 'tel', false, '(11) 98765-4321')}

                <div className="field email-field">
                  <label htmlFor="email">E-mail para confirmação e rastreamento</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="seu.email@exemplo.com"
                    value={values.email}
                    onChange={(event) => {
                      change('email', event.target.value);
                      setEmailFocused(true);
                    }}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    autoComplete="off"
                    required
                    maxLength={200}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                  />
                  {emailFocused && emailSuggestions.length > 0 && (
                    <div className="email-suggestions" id="email-suggestions" role="listbox">
                      {emailSuggestions.map((suggestion) => {
                        const domain = suggestion.slice(emailUser.length + 1);
                        return (
                          <button
                            type="button"
                            role="option"
                            key={suggestion}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              change('email', suggestion);
                              setEmailFocused(false);
                            }}
                          >
                            <span>{emailUser}@</span>
                            <strong>{domain}</strong>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {errors.email && (
                    <p className="field__error" id="email-error">
                      {errors.email}
                    </p>
                  )}
                </div>
              </div>

              <div className="step-actions">
                <button className="btn btn--pay-cta" type="submit" disabled={paymentLoading}>
                  <Icon name="lock" />
                  <span>{actionLabel}</span>
                </button>
                <p className="secure-badge-micro">
                  🔒 Ambiente Seguro · Seus dados estão 100% protegidos
                </p>
              </div>
            </section>
          )}

          {/* ETAPA 2: ENDEREÇO & FRETE */}
          {step === 2 && (
            <section className="panel step">
              <div className="step__head">
                <div className="step__title-wrap">
                  <span className="step__num">2</span>
                  <h2>Endereço de Entrega</h2>
                </div>
              </div>

              <div className="fields">
                <div className="row-cep">
                  <div className="field field--cep">
                    <label htmlFor="cep">CEP</label>
                    <input
                      id="cep"
                      name="cep"
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="00000-000"
                      value={values.cep}
                      onKeyDown={handleNumericKeyDown}
                      onChange={(e) => change('cep', e.target.value)}
                      maxLength={9}
                      required
                      aria-invalid={Boolean(errors.cep)}
                    />
                    {errors.cep && <p className="field__error">{errors.cep}</p>}
                  </div>
                  <div className="cep-feedback">
                    {cepStatus === 'loading' && <span className="cep-tag cep-tag--loading">⏳ Buscando...</span>}
                    {cepStatus === 'success' && <span className="cep-tag cep-tag--success">✓ Localizado</span>}
                    {cepStatus === 'error' && <span className="cep-tag cep-tag--error">⚠️ Não localizado</span>}
                    <a
                      href="https://buscacepinter.correios.com.br/app/endereco/index.php"
                      target="_blank"
                      rel="noreferrer"
                      className="cep-help-link"
                    >
                      Não sei meu CEP
                    </a>
                  </div>
                </div>

                {field('endereco', 'Endereço (Rua, Avenida, etc)', 'text', false, 'Ex: Avenida Paulista')}

                <div className="row2 row2--num">
                  {field('numero', 'Número', 'text', false, '123')}
                  {field('complemento', 'Complemento', 'text', true, 'Apto, Bloco')}
                </div>

                <div className="row3">
                  {field('bairro', 'Bairro', 'text', false, 'Bela Vista')}
                  {field('cidade', 'Cidade', 'text', false, 'São Paulo')}
                  <div className="field">
                    <label htmlFor="estado">UF</label>
                    <select
                      id="estado"
                      name="estado"
                      value={values.estado}
                      onChange={(event) => change('estado', event.target.value)}
                      required
                      aria-invalid={Boolean(errors.estado)}
                    >
                      <option value="">UF</option>
                      {states.map((uf) => (
                        <option key={uf} value={uf}>
                          {uf}
                        </option>
                      ))}
                    </select>
                    {errors.estado && <p className="field__error">{errors.estado}</p>}
                  </div>
                </div>
              </div>

              {!isAddressComplete && (
                <p className="address-incomplete-hint">
                  📍 Preencha seu endereço e número acima para liberar as opções de frete.
                </p>
              )}

              {isAddressComplete && (
                <div className="shipping-block shipping-section-fadein">
                  <div className="shipping-block__header">
                    <svg
                      className="shipping-truck-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
                      <path d="M15 18H9" />
                      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
                      <circle cx="7" cy="18" r="2" />
                      <circle cx="17" cy="18" r="2" />
                    </svg>
                    <h3>Opções de Envio</h3>
                  </div>

                  <div className="shipopts">
                    {Object.entries(deliveryModes)
                      .filter(([mode]) => mode !== 'agendada')
                      .map(([mode, option]) => (
                        <label className={`shipopt ${values.mode === mode ? 'is-selected' : ''}`} key={mode}>
                          <input
                            type="radio"
                            name="mode"
                            value={mode}
                            checked={values.mode === mode}
                            onChange={(event) => change('mode', event.target.value)}
                          />
                          <span className="shipopt__dot" />
                          <div className="shipopt__info">
                            <span className="shipopt__title">{option.label}</span>
                            <span className="shipopt__desc">{option.description}</span>
                          </div>
                          <div className="shipopt__price">
                            {option.cents ? (
                              <strong>{money(option.cents)}</strong>
                            ) : (
                              <span className="free-badge">GRÁTIS</span>
                            )}
                          </div>
                        </label>
                      ))}
                  </div>

                  <div className="step-actions">
                    <button className="btn btn--pay-cta" type="submit" disabled={paymentLoading}>
                      <Icon name="lock" />
                      <span>{actionLabel}</span>
                    </button>
                    <p className="secure-badge-micro">
                      🔒 Ambiente Seguro · Seus dados estão 100% protegidos
                    </p>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ETAPA 3: CONFIRMAÇÃO & PAGAMENTO */}
          {step === 3 && (
            <section className="panel step">
              <div className="step__head">
                <div className="step__title-wrap">
                  <span className="step__num">3</span>
                  <h2>Forma de Pagamento</h2>
                </div>
              </div>

              <div className="review-compact">
                <div className="review-compact__item">
                  <div className="review-compact__label">
                    <span className="review-compact__check">✓</span>
                    <span>Dados do comprador</span>
                  </div>
                  <button type="button" className="review-compact__btn" onClick={() => setStep(1)}>
                    Alterar
                  </button>
                </div>
                <div className="review-compact__item">
                  <div className="review-compact__label">
                    <span className="review-compact__check">✓</span>
                    <span>Endereço de entrega</span>
                  </div>
                  <button type="button" className="review-compact__btn" onClick={() => setStep(2)}>
                    Alterar
                  </button>
                </div>
              </div>

              {/* Forma de Pagamento */}
              <div>
                <h3 className="payment-section__title">Forma de pagamento:</h3>

                <div className="pay-tab is-active" style={{ cursor: 'default' }}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="pix"
                    checked
                    readOnly
                  />
                  <div className="pay-tab__content">
                    <div className="pay-tab__top">
                      <span className="pay-tab__name">
                        <img
                          src="/assets/pix.png"
                          alt="PIX"
                          className="pix-logo-icon"
                          width={20}
                          height={20}
                        />
                        PIX Instantâneo
                      </span>
                      <span className="pay-tab__tag">5% OFF</span>
                    </div>
                    <span className="pay-tab__sub">Aprovação imediata · QR Code & Copia e Cola</span>
                  </div>
                </div>
              </div>

              {/* Order Bump Promocional com CPF */}
              <div className="order-bump">
                <div className="order-bump__header">
                  <span>✨ OFERTA EXCLUSIVA – SÓ AQUI!</span>
                </div>
                <label className={`order-bump__box ${orderBump ? 'is-selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={orderBump}
                    onChange={(e) => setOrderBump(e.target.checked)}
                  />
                  <span className="order-bump__checkbox-custom">
                    {orderBump ? '✓' : ''}
                  </span>
                  <img
                    src={bumpProduct.image}
                    alt={bumpProduct.name}
                    className="order-bump__img"
                  />
                  <div className="order-bump__info">
                    <strong>Adicionar Kit 32 Enfeites Azul, Branco e Prata</strong>
                    <p>Conjunto elegante com 32 peças (bolas, gotas e pendentes) em tons azul e prata. Perfeito para complementar sua árvore!</p>
                    <div className="order-bump__price-row">
                      <span className="old-price">{money(bumpProduct.price_cents)}</span>
                      <span className="new-price">{money(bumpPrice)}</span>
                    </div>
                  </div>
                </label>

                <div className="order-bump__cpf">
                  {field('cpf', 'CPF (para emissão da nota fiscal)', 'tel', false, '000.000.000-00')}
                </div>
              </div>

              <div className="step-actions">
                <button className="btn btn--pay-cta" type="submit" disabled={paymentLoading}>
                  <Icon name="lock" />
                  <span>{paymentLoading ? 'Processando pedido…' : actionLabel}</span>
                </button>
                <p className="secure-badge-micro">
                  🔒 Ambiente Seguro · Seus dados estão 100% protegidos
                </p>
              </div>
            </section>
          )}

          {Object.keys(errors).some((key) => errors[key as keyof CheckoutData]) && (
            <p className="form-error" role="alert">
              Confira os campos obrigatórios destacados em vermelho antes de continuar.
            </p>
          )}
          {paymentError && (
            <p className="form-error" role="alert">
              {paymentError}
            </p>
          )}
        </form>
      </main>

      {/* RODAPÉ DE SEGURANÇA E FORMAS DE PAGAMENTO */}
      <footer className="checkout-footer">
        <div className="container">
          <p className="checkout-footer__title">Formas de pagamento</p>

          <div className="payment-badges-grid">
            <span className="pbadge" title="American Express"><span className="pbadge__amex">AMEX</span></span>
            <span className="pbadge" title="Visa"><span className="pbadge__visa">VISA</span></span>
            <span className="pbadge" title="Diners Club">
              <svg viewBox="0 0 24 16" width="24" height="15"><circle cx="8" cy="8" r="6" fill="#0079be"/><circle cx="16" cy="8" r="6" fill="#0079be" fillOpacity="0.6"/><path d="M12 4v8" stroke="#fff" strokeWidth="1.5"/></svg>
            </span>
            <span className="pbadge" title="Mastercard">
              <svg viewBox="0 0 28 18" width="24" height="15"><circle cx="9" cy="9" r="8" fill="#eb001b"/><circle cx="19" cy="9" r="8" fill="#f79e1b" fillOpacity="0.85"/></svg>
            </span>
            <span className="pbadge" title="Discover">
              <span className="pbadge__discover">DISCOVER</span>
            </span>
            <span className="pbadge" title="Aura"><span className="pbadge__aura">Aura</span></span>
            <span className="pbadge" title="Hipercard"><span className="pbadge__hipercard">Hipercard</span></span>
            <span className="pbadge" title="Elo">
              <span className="pbadge__elo">elo</span>
            </span>
            <span className="pbadge" title="Hiper"><span className="pbadge__hiper">Hiper</span></span>
            <span className="pbadge" title="PIX">
              <img src="/assets/pix.png" alt="PIX" width={16} height={16} style={{ objectFit: 'contain' }} />
            </span>
            <span className="pbadge" title="Boleto Bancário">
              <svg viewBox="0 0 26 18" width="22" height="15"><rect x="2" y="1" width="2" height="9" fill="#231f20"/><rect x="6" y="1" width="1" height="9" fill="#231f20"/><rect x="9" y="1" width="3" height="9" fill="#231f20"/><rect x="14" y="1" width="1" height="9" fill="#231f20"/><rect x="17" y="1" width="2" height="9" fill="#231f20"/><rect x="21" y="1" width="3" height="9" fill="#231f20"/><text x="1" y="14" fontSize="4.2" fontWeight="900" fill="#231f20">BOLETO</text></svg>
            </span>
          </div>

          <div className="checkout-footer__info">
            <strong>Encanto Natalino</strong>
            <p>E-mail: suporte@encantonatalino.com.br</p>
          </div>

          <div className="checkout-footer__security">
            <Icon name="lock" />
            <div>
              <strong>PAGAMENTO</strong>
              <span>100% SEGURO</span>
            </div>
          </div>
        </div>
      </footer>
    </PageFrame>
  );
}
