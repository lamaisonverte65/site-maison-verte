import { useMemo } from "react";
import { normalizeSource } from "../utils/adminFormatters";

function pairs(rows, labelMap = (label) => label) {
  if (!Array.isArray(rows)) return [];
  const counts = new Map();
  for (const { label, count } of rows) {
    const key = labelMap(label || "Non renseigné");
    counts.set(key, (counts.get(key) || 0) + Number(count || 0));
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

// R18 : ce hook consomme exclusivement le résumé SQL (aucun événement brut).
export function useVisitsData({ visitSummary }) {
  return useMemo(() => ({
    dailyVisitStats: (visitSummary?.daily || []).map(({ date, pages }) => ({
      date,
      label: new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
      pages: Number(pages || 0),
    })),
    pageStats: pairs(visitSummary?.pages),
    visitSourceStats: pairs(visitSummary?.sources, normalizeSource),
    languageStats: pairs(visitSummary?.languages),
    deviceStats: pairs(visitSummary?.devices),
  }), [visitSummary]);
}
