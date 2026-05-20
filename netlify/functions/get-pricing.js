import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

export async function handler() {
  try {
    const { data: settings, error: settingsError } = await supabase
      .from("pricing_settings")
      .select("*")
      .eq("id", "default")
      .maybeSingle();

    if (settingsError) throw settingsError;

    const { data: seasonPrices, error: seasonError } = await supabase
      .from("season_prices")
      .select("*")
      .eq("is_active", true)
      .order("start_date", { ascending: true });

    if (seasonError) throw seasonError;

    const { data: priceOverrides, error: overrideError } = await supabase
      .from("price_overrides")
      .select("*")
      .eq("is_active", true)
      .order("start_date", { ascending: true });

    if (overrideError) throw overrideError;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, max-age=0",
      },
      body: JSON.stringify({
        defaultNightPrice: Number(settings?.default_night_price || 80),
        seasonPrices: seasonPrices || [],
        priceOverrides: priceOverrides || [],
      }),
    };
  } catch (error) {
    console.error("Erreur get-pricing :", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
}
