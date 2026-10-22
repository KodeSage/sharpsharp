import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase env vars. Check .env for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

export type Shop = {
  id: string;
  slug: string;
  name: string;
  category: string;
  city: string;
  whatsapp: string;
  hours: string;
  tagline: string | null;
  brand_color: string;
  banner_url: string | null;
  created_at: string;
};

export type Item = {
  id: string;
  shop_id: string;
  name: string;
  price: number;
  description: string | null;
  position: number;
  available: boolean;
  image_url: string | null;
  created_at: string;
};

const SUPABASE_URL = supabaseUrl.replace(/\/$/, '');

export function publicImagePath(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${path}`;
}

export async function uploadShopImage(
  file: File,
  slug: string,
  kind: 'banner' | 'item'
): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${slug}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from('shop-images')
    .upload(fileName, file, { contentType: file.type, upsert: false });

  if (error) return null;
  return publicImagePath(`shop-images/${fileName}`);
}

export type ShopStats = {
  total_views: number;
  total_order_clicks: number;
  order_clicks_7d: number;
};

export function naira(amount: number): string {
  return '₦' + amount.toLocaleString('en-NG');
}

export function whatsappLink(whatsapp: string, message: string): string {
  const text = encodeURIComponent(message);
  return `https://wa.me/${whatsapp}?text=${text}`;
}
