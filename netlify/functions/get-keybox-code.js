import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler() {
  try {
    const { data, error } = await supabase
      .from("pricing_settings")
      .select("keybox_code")
      .eq("id", "default")
      .maybeSingle();

    if (error) throw error;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, max-age=0",
      },
      body: JSON.stringify({ keyboxCode: String(data?.keybox_code || "").trim() }),
    };
  } catch (error) {
    console.error("Erreur get-keybox-code :", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Code indisponible." }) };
  }
}
