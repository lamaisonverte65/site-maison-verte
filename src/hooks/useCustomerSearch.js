import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function cleanSearch(value) {
  return String(value || "")
    .trim()
    .replace(/[%_]/g, "")
    .slice(0, 40);
}

function getScore(customer, firstName, lastName) {
  const first = normalize(firstName);
  const last = normalize(lastName);
  const customerFirst = normalize(customer.first_name);
  const customerLast = normalize(customer.last_name);
  let score = 0;

  if (first && customerFirst === first) score += 50;
  else if (first && customerFirst.startsWith(first)) score += 35;
  else if (first && customerFirst.includes(first)) score += 15;

  if (last && customerLast === last) score += 60;
  else if (last && customerLast.startsWith(last)) score += 40;
  else if (last && customerLast.includes(last)) score += 20;

  score += Math.min(Number(customer.booking_count || 0), 10);
  if (customer.last_stay) score += 2;

  return score;
}

export function useCustomerSearch({ firstName = "", lastName = "", minLength = 2, limit = 6 } = {}) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const first = cleanSearch(firstName);
  const last = cleanSearch(lastName);

  const searchKey = useMemo(() => `${first}|${last}|${minLength}|${limit}`, [first, last, minLength, limit]);

  useEffect(() => {
    const firstReady = first.length >= minLength;
    const lastReady = last.length >= minLength;

    if (!firstReady && !lastReady) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const filters = [];
        if (firstReady) {
          filters.push(`first_name.ilike.${first}%`);
          filters.push(`last_name.ilike.${first}%`);
        }
        if (lastReady) {
          filters.push(`last_name.ilike.${last}%`);
          filters.push(`first_name.ilike.${last}%`);
        }

        const { data, error: queryError } = await supabase
          .from("customers")
          .select("id, first_name, last_name, email, phone, booking_count, last_stay")
          .or(filters.join(","))
          .limit(25);

        if (queryError) throw queryError;
        if (cancelled) return;

        const sorted = (data || [])
          .map((customer) => ({ ...customer, _score: getScore(customer, first, last) }))
          .sort((a, b) => b._score - a._score || String(a.last_name || "").localeCompare(String(b.last_name || ""), "fr", { sensitivity: "base" }))
          .slice(0, limit);

        setResults(sorted);
      } catch (searchError) {
        if (cancelled) return;
        setResults([]);
        setError(searchError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [searchKey, first, last, minLength, limit]);

  return { results, loading, error };
}
