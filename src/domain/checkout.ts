import { deliveryModes, type DeliveryMode } from './commerce';

export const states = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
export type CheckoutData = {
  nome: string; telefone: string; cpf: string; email: string; recebedor: string; mensagem: string;
  cep: string; endereco: string; numero: string; complemento: string; bairro: string; cidade: string; estado: string;
  data: string; periodo: string; mode: DeliveryMode;
};
export const emptyCheckout: CheckoutData = {
  nome: '', telefone: '', cpf: '', email: '', recebedor: '', mensagem: '', cep: '', endereco: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', data: '', periodo: '', mode: 'padrao',
};
export const demoCheckout: CheckoutData = {
  nome: 'Cliente Encanto Natalino', telefone: '(11) 98765-4321', cpf: '529.982.247-25', email: 'cliente@encantonatalino.com.br', recebedor: 'Cliente Encanto Natalino', mensagem: 'Que este Natal traga muita paz, luz e união para nosso lar!', cep: '01310-100', endereco: 'Avenida Paulista', numero: '1000', complemento: 'Apto 42', bairro: 'Bela Vista', cidade: 'São Paulo', estado: 'SP', data: '', periodo: '', mode: 'padrao',
};
export const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const validDdds = new Set(['11', '12', '13', '14', '15', '16', '17', '18', '19', '21', '22', '24', '27', '28', '31', '32', '33', '34', '35', '37', '38', '41', '42', '43', '44', '45', '46', '47', '48', '49', '51', '53', '54', '55', '61', '62', '63', '64', '65', '66', '67', '68', '69', '71', '73', '74', '75', '77', '79', '81', '82', '83', '84', '85', '86', '87', '88', '89', '91', '92', '93', '94', '95', '96', '97', '98', '99']);
const onlyDigits = (value: string) => value.replace(/\D/g, '');
export const formatPhone = (value: string) => {
  const number = onlyDigits(value).slice(0, 11);
  if (!number) return '';
  if (number.length <= 2) return `(${number}`;
  if (number.length <= 7) return `(${number.slice(0, 2)}) ${number.slice(2)}`;
  return `(${number.slice(0, 2)}) ${number.slice(2, 7)}-${number.slice(7)}`;
};
export const formatCpf = (value: string) => {
  const number = onlyDigits(value).slice(0, 11);
  return number.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2');
};
export const formatCep = (value: string) => {
  const number = onlyDigits(value).slice(0, 8);
  return number.replace(/^(\d{5})(\d)/, '$1-$2');
};
export type CepAddress = { endereco: string; bairro: string; cidade: string; estado: string };
export async function lookupCep(value: string, signal?: AbortSignal): Promise<CepAddress> {
  const number = onlyDigits(value);
  if (!/^\d{8}$/.test(number)) throw new Error('Informe um CEP válido.');
  const response = await fetch(`https://viacep.com.br/ws/${number}/json/`, { signal });
  if (!response.ok) throw new Error('Não foi possível consultar o CEP.');
  const result: unknown = await response.json();
  if (typeof result !== 'object' || result === null || ('erro' in result && result.erro === true)) throw new Error('CEP não encontrado.');
  const address = result as Record<string, unknown>;
  if (typeof address.localidade !== 'string' || typeof address.uf !== 'string' || !states.includes(address.uf)) throw new Error('Resposta inválida da consulta de CEP.');
  return {
    endereco: typeof address.logradouro === 'string' ? address.logradouro : '',
    bairro: typeof address.bairro === 'string' ? address.bairro : '',
    cidade: address.localidade,
    estado: address.uf,
  };
}
export function validCpf(value: string): boolean {
  const digits = onlyDigits(value);
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  return [9, 10].every((length) => {
    const sum = [...digits.slice(0, length)].reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0);
    return ((sum * 10) % 11) % 10 === Number(digits[length]);
  });
}
export function validateCheckout(data: CheckoutData, date = today()): Partial<Record<keyof CheckoutData, string>> {
  const errors: Partial<Record<keyof CheckoutData, string>> = {};
  if (!data.recebedor || !data.recebedor.trim()) {
    data.recebedor = data.nome.trim();
  }
  const required: (keyof CheckoutData)[] = ['nome', 'endereco', 'numero', 'bairro', 'cidade'];
  for (const key of required) if (!data[key].trim()) errors[key] = 'Preencha este campo.';
  if (data.nome.trim().split(/\s+/).length < 2) errors.nome = 'Informe nome e sobrenome.';
  for (const [key, value] of Object.entries(data)) if (value.length > 200) errors[key as keyof CheckoutData] = 'Use no máximo 200 caracteres.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.email = 'Informe um e-mail válido.';
  const phone = onlyDigits(data.telefone);
  if (!validDdds.has(phone.slice(0, 2)) || !/^9\d{8}$/.test(phone.slice(2))) errors.telefone = 'Informe um celular válido com DDD.';
  if (!validCpf(data.cpf)) errors.cpf = 'Informe um CPF válido ou use os dados de demonstração.';
  if (!/^\d{8}$/.test(data.cep.replace(/\D/g, '')) || /^0+$/.test(data.cep.replace(/\D/g, ''))) errors.cep = 'Informe um CEP válido.';
  if (!states.includes(data.estado)) errors.estado = 'Selecione um estado.';
  if (!Object.hasOwn(deliveryModes, data.mode)) errors.mode = 'Selecione uma modalidade de entrega.';
  if (data.mode === 'agendada') {
    const parsed = new Date(`${data.data}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.data) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== data.data || data.data < date) errors.data = 'Escolha uma data válida, a partir de hoje.';
    if (!['08h às 12h', '12h às 18h', '18h às 22h'].includes(data.periodo)) errors.periodo = 'Selecione o período de entrega.';
  }
  return errors;
}
