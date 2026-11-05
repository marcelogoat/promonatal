export const config = { runtime: 'edge' };

import { createPixResponse } from '../../src/server/pix';

export default function handler(request: Request) {
  return createPixResponse(request, process.env.VENO_API_KEY ?? process.env.BLACKCAT_SECRET_KEY ?? '');
}
