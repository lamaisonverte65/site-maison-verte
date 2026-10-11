import { createClient } from "@supabase/supabase-js";
import { verifyGuestReviewValidationToken } from "./_lib/guest-review-validation.js";

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const json = (statusCode, body) => new Response(JSON.stringify(body), { status: statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const FIELDS = "id, created_at, display_name, guest_first_name, rating, comment, stay_period, status, published_at";

function publicReview(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    displayName: row.display_name || row.guest_first_name || "Voyageur",
    rating: row.rating,
    comment: row.comment,
    stayPeriod: row.stay_period,
    status: row.status,
    publishedAt: row.published_at,
  };
}

async function loadReview(reviewId) {
  const { data, error } = await supabase.from("guest_reviews").select(FIELDS).eq("id", reviewId).maybeSingle();
  if (error) throw error;
  return data;
}

export default async function handler(request) {
  try {
    if (request.method === "GET") {
      const token = new URL(request.url).searchParams.get("token") || "";
      const { reviewId } = verifyGuestReviewValidationToken(token);
      const review = await loadReview(reviewId);
      if (!review) return json(404, { error: "Avis introuvable." });
      return json(200, { review: publicReview(review) });
    }

    if (request.method === "POST") {
      let input;
      try { input = await request.json(); } catch { return json(400, { error: "Corps JSON invalide." }); }
      const action = String(input?.action || "");
      if (action !== "publish" && action !== "refuse") return json(400, { error: "Action invalide." });
      const { reviewId } = verifyGuestReviewValidationToken(input?.token || "");
      const current = await loadReview(reviewId);
      if (!current) return json(404, { error: "Avis introuvable." });
      if (current.status !== "pending") {
        return json(409, { error: "Cet avis a déjà été traité.", currentStatus: current.status, review: publicReview(current) });
      }

      const updates = action === "publish"
        ? { status: "published", published_at: new Date().toISOString() }
        : { status: "refused", published_at: null };
      const { data: updated, error } = await supabase
        .from("guest_reviews")
        .update(updates)
        .eq("id", reviewId)
        .eq("status", "pending")
        .select(FIELDS)
        .maybeSingle();
      if (error) throw error;
      if (!updated) return json(409, { error: "Cet avis a déjà été traité.", currentStatus: (await loadReview(reviewId))?.status || "unknown" });
      return json(200, { success: true, review: publicReview(updated) });
    }

    return json(405, { error: "Method Not Allowed" });
  } catch (error) {
    const message = String(error?.message || error || "");
    if (/token/i.test(message)) return json(401, { error: message });
    console.error("Erreur validation avis:", error);
    return json(500, { error: "La validation de l’avis est momentanément indisponible." });
  }
}
