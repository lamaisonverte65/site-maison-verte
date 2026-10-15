import { createClient } from "@supabase/supabase-js";

export async function handler(event = {}, context, dependencies = {}) {
  if (event.httpMethod !== "GET") return { statusCode: 405, headers: { Allow: "GET" }, body: "" };
  try {
    const supabase = dependencies.createClient ? dependencies.createClient() : createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase.from("guest_reviews")
      .select("id,rating,comment,display_name,guest_first_name,stay_period")
      .eq("status", "published").order("published_at", { ascending: false }).limit(6);
    if (error) throw error;
    const reviews = (data || []).map((review) => ({
      id: review.id, rating: review.rating, comment: review.comment,
      display_name: review.display_name || review.guest_first_name || "Voyageur",
      stay_period: review.stay_period,
    }));
    return { statusCode: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify({ reviews }) };
  } catch {
    return { statusCode: 500, body: JSON.stringify({ error: "Avis temporairement indisponibles." }) };
  }
}
