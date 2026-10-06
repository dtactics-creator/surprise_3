import { supabase } from "./supabase";
import type { Offer } from "./data";

export function normalizeHostname(host?: string): string {
  if (!host) return '';
  let clean = host.trim().toLowerCase();
  clean = clean.replace(/^[a-z0-9+\-.]+:\/\//i, '');
  clean = clean.split('/')[0].split('?')[0].split('#')[0];
  clean = clean.replace(/:\d+$/, '');
  if (clean.endsWith('.')) clean = clean.slice(0, -1);
  return clean;
}

export async function fetchActiveOffers(domain?: string): Promise<Offer[]> {
  const cleanDomain = normalizeHostname(domain);
  if (!cleanDomain) return [];

  // Find the mapped products in the active setup for this exact domain
  const { data: rawData, error: setupError } = await supabase
    .from("dt_campaign_setups" as any)
    .select("campaign_products, company_id, branch_id")
    .eq("status", "active")
    .eq("domain", cleanDomain)
    .maybeSingle();

  const setupData = rawData as any;

  if (setupError || !setupData || !Array.isArray(setupData.campaign_products)) {
    return []; // Return no offers if domain setup is not found or invalid
  }

  // Handle both legacy string array and new object array [{product_id, sort_order}] or [{id, sort_order}]
  const productIds = setupData.campaign_products.map((p: any) => typeof p === 'string' ? p : (p.product_id || p.id));
  const sortMap = new Map<string, number>(
    setupData.campaign_products.map((p: any, idx: number) => [
      typeof p === 'string' ? p : (p.product_id || p.id),
      typeof p === 'object' && p !== null ? Number(p.sort_order ?? idx) : idx
    ])
  );

  if (productIds.length === 0) {
    return [];
  }

  let query: any = supabase
    .from("dt_campaigns" as any)
    .select("id, type, title, description, coupon_code, cta_label, category, brand")
    .eq("is_active", true)
    .eq("company_id", setupData.company_id)
    .in("id", productIds);

  if (setupData.branch_id) {
    query = query.or(`branch_id.eq.${setupData.branch_id},branch_id.is.null`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching offers", error);
    return [];
  }
  
  let offersData = (data ?? []) as any[];
  offersData.sort((a, b) => (sortMap.get(a.id) ?? 999) - (sortMap.get(b.id) ?? 999));

  return offersData.map((row: any) => ({
    type: row.type || "deal",
    category: row.category || undefined,
    brand: row.brand || undefined,
    value: row.title || "",
    code: row.coupon_code || row.cta_label || "",
    blurb: row.description || "",
  }));
}

export type TemplateConfig = {
  background: string;
  bgImage: string;
  googleFontUrl: string;
  titleFontFamily: string;
  bodyFontFamily: string;
  title: string;
  titleColor: string;
  subtitle: string;
  subtitleColor: string;
  lampImage: string;
  [key: string]: any;
};

export type CampaignTemplate = {
  id: string;
  name: string;
  default_config: TemplateConfig;
  start_datetime: string | null;
  end_datetime: string | null;
  status: string;
  campaign_setup_id?: string;
  dynamic_title?: string;
};

export async function fetchActiveCampaignTemplate(domain?: string): Promise<CampaignTemplate | null> {
  try {
    const cleanDomain = normalizeHostname(domain);
    if (!cleanDomain) return null;

    let query = supabase
      .from("dt_campaign_setups")
      .select("*, templates:dt_campaign_setup_templates(*, template:dt_campaign_templates(*))")
      .eq("status", "active")
      .eq("domain", cleanDomain)
      .order("created_at", { ascending: false })
      .limit(1);

    const { data: setupData, error } = await query.maybeSingle();

    if (error || !setupData || !setupData.templates) return null;

    const templates = setupData.templates as any[];
    templates.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    const now = new Date().getTime();
    let activeTemplate = templates.find(t => {
      if (!t.start_datetime || !t.end_datetime) return false;
      return now >= new Date(t.start_datetime).getTime() && now <= new Date(t.end_datetime).getTime();
    });

    if (!activeTemplate && templates.length > 0) {
      activeTemplate = setupData.play_mode === 'loop' ? templates[0] : templates[templates.length - 1];
    }

    const t = activeTemplate?.template as CampaignTemplate | undefined;
    if (t) {
      const start = setupData.start_datetime ? new Date(setupData.start_datetime).getTime() : null;
      const end = setupData.end_datetime ? new Date(setupData.end_datetime).getTime() : null;
      
      if (start && now < start) return null;
      if (end && now > end) return null;

      t.start_datetime = setupData.start_datetime || null;
      t.end_datetime = setupData.end_datetime || null;
      t.status = setupData.status;
      t.campaign_setup_id = setupData.id;
      t.dynamic_title = setupData.dynamic_title || undefined;
      return t;
    }
    return null;
  } catch (e) {
    console.error("Failed to fetch template from Supabase:", e);
    return null;
  }
}
