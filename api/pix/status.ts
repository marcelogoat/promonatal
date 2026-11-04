export const config = { runtime: 'edge' };

import { pixStatusResponse } from '../../src/server/pix';

export default function handler(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id') || url.pathname.split('/').pop() || '';
  return pixStatusResponse(id, process.env.BLACKCAT_SECRET_KEY ?? '');
}

