export function formatDateValue(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("fr-FR");
  } catch {
    return String(value);
  }
}

export function formatBool(value) {
  if (value === true || value === "true" || value === "oui" || value === "yes") return "Oui";
  if (value === false || value === "false" || value === "non" || value === "no") return "Non";
  return value ? String(value) : "-";
}

export function displayValue(value) {
  return value === null || value === undefined || value === "" ? "-" : value;
}
