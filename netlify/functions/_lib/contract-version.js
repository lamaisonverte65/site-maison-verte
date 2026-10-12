const CONTRACT_ORIGIN = "https://lamaisonverte65.fr";
const IMMUTABLE_CONTRACT_PATH = /^\/documents\/contrat-location-V\d+\.\d+\.pdf$/;

export const CURRENT_CONTRACT_VERSION = "v1.5";
export const CURRENT_CONTRACT_URL = `${CONTRACT_ORIGIN}/documents/contrat-location-V1.5.pdf`;

export function resolveBookingContractUrl(value) {
  try {
    const url = new URL(String(value ?? "").trim());
    const isTrusted = url.protocol === "https:"
      && url.hostname === "lamaisonverte65.fr"
      && url.port === ""
      && !url.username
      && !url.password
      && !url.search
      && !url.hash
      && IMMUTABLE_CONTRACT_PATH.test(url.pathname);

    return isTrusted ? `${CONTRACT_ORIGIN}${url.pathname}` : CURRENT_CONTRACT_URL;
  } catch {
    return CURRENT_CONTRACT_URL;
  }
}
