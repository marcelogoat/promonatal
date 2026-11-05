export const config = { runtime: 'edge' };

import { pixStatusResponse } from '../../../src/server/pix';

export default function handler(request: Request) {
  if (request.method !== 'GET') return new Response('Método não permitido.', { status: 405 });
  const transactionId = decodeURIComponent(new URL(request.url).pathname.split('/').pop() ?? '');
  return pixStatusResponse(transactionId, process.env.VENO_API_KEY ?? process.env.BLACKCAT_SECRET_KEY ?? '');
}
