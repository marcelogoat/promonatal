import source from '../data/catalog.json';

export type ProductOption = {
  name: string;
  position?: number;
  values: string[];
};

export type ProductVariant = {
  id: number;
  title: string;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  price_cents: number;
  old_price_cents: number | null;
  available?: boolean;
};

export type ProductReview = {
  id: string;
  author: string;
  city: string;
  date: string;
  rating: number;
  title: string;
  comment: string;
  verified: boolean;
};

export type Product = {
  id: number;
  slug: string;
  name: string;
  category: string;
  categories: string[];
  price_cents: number;
  old_price_cents: number | null;
  image: string;
  images?: string[];
  sold_out: boolean;
  description?: string;
  desc?: string;
  brand?: string;
  options?: ProductOption[];
  variants?: ProductVariant[];
  body_html?: string;
  rating?: number;
  reviews_count?: number;
  reviews?: ProductReview[];
};

export const products: Product[] = source as Product[];
export const categories = [
  'Árvores de Natal',
  'Guirlandas & Enfeites',
  'Luzes & Pisca-Pisca',
  'Presépios & Bonecos',
  'Velas & Aromas',
  'Kits & Presentes',
  'Mesa Posta & Ceia',
];
export const occasions = [
  'Ceia de Natal',
  'Decoração Completa',
  'Presentear',
  'Mesa Posta',
  'Árvores & Pinheiros',
];
export const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function productById(id: number): Product {
  const product = products.find((item) => item.id === id);
  if (!product) {
    return products[0]; // Safe fallback so outdated IDs never crash the view
  }
  return product;
}

const occasionCategories: Record<string, string[]> = {
  'Ceia de Natal': ['Mesa Posta & Ceia', 'Velas & Aromas', 'Guirlandas & Enfeites'],
  'Decoração Completa': ['Árvores de Natal', 'Guirlandas & Enfeites', 'Luzes & Pisca-Pisca'],
  'Presentear': ['Kits & Presentes', 'Presépios & Bonecos', 'Velas & Aromas', 'Árvores de Natal'],
  'Mesa Posta': ['Mesa Posta & Ceia', 'Velas & Aromas'],
  'Árvores & Pinheiros': ['Árvores de Natal'],
};

export type CatalogFilter = {
  search?: string;
  query?: string;
  category?: string;
  occasion?: string;
  sort?: string;
  promotion?: boolean;
};

export function filterProducts(filter: CatalogFilter): Product[] {
  const rawQ = filter.query ?? filter.search ?? '';
  const q = normalize(rawQ);
  let matches = products.filter((item: Product) => {
    if (filter.category && item.category !== filter.category) return false;
    if (filter.occasion) {
      const allowed = occasionCategories[filter.occasion] ?? [];
      if (!allowed.includes(item.category)) return false;
    }
    if (filter.promotion && (!item.old_price_cents || item.old_price_cents <= item.price_cents)) return false;
    if (!q) return true;
    return (
      normalize(item.name).includes(q) ||
      normalize(item.category).includes(q) ||
      item.categories.some((cat) => normalize(cat).includes(q)) ||
      normalize(item.description ?? '').includes(q)
    );
  });

  if (filter.sort === 'preco-asc') {
    matches = [...matches].sort((a, b) => a.price_cents - b.price_cents);
  } else if (filter.sort === 'preco-desc') {
    matches = [...matches].sort((a, b) => b.price_cents - a.price_cents);
  }

  return matches;
}
