export const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'src',
  'sck',
  'fbclid',
  'gclid',
] as const;

export type UtmParams = Partial<Record<(typeof UTM_KEYS)[number], string>>;

const STORAGE_KEY = 'encanto_natalino_utms';

export function captureUtms(): UtmParams {
  if (typeof window === 'undefined') return {};
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const existing = getStoredUtms();
    let hasNew = false;

    for (const key of UTM_KEYS) {
      const val = searchParams.get(key);
      if (val && val.trim()) {
        existing[key] = val.trim();
        hasNew = true;
      }
    }

    if (hasNew) {
      const json = JSON.stringify(existing);
      localStorage.setItem(STORAGE_KEY, json);
      sessionStorage.setItem(STORAGE_KEY, json);
    }

    return existing;
  } catch {
    return {};
  }
}

export function getStoredUtms(): UtmParams {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function withUtms(url: string, extraParams?: Record<string, string>): string {
  if (typeof window === 'undefined') return url;
  try {
    const stored = { ...getStoredUtms(), ...(extraParams || {}) };
    const hasParams = Object.keys(stored).length > 0;
    if (!hasParams) return url;

    const [pathAndQuery, hash] = url.split('#');
    const [path, queryString] = pathAndQuery.split('?');
    const params = new URLSearchParams(queryString || '');

    for (const [k, v] of Object.entries(stored)) {
      if (v && !params.has(k)) {
        params.set(k, v);
      }
    }

    const newQuery = params.toString();
    const result = newQuery ? `${path}?${newQuery}` : path;
    return hash !== undefined ? `${result}#${hash}` : result;
  } catch {
    return url;
  }
}
