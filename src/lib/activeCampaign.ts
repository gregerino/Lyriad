/**
 * Which campaign's favourites the desk shows above the music slots. Kept in a
 * cookie rather than localStorage so it survives the same way the last-opened
 * scene does, and so a server render could read it later if that becomes
 * useful. An empty value means "all campaigns".
 */
export const ACTIVE_CAMPAIGN_COOKIE = "lyriad_active_campaign";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function readActiveCampaignId(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${ACTIVE_CAMPAIGN_COOKIE}=([^;]*)`));
  const value = match ? decodeURIComponent(match[1]!) : "";
  return value || null;
}

export function writeActiveCampaignId(id: string | null) {
  if (typeof document === "undefined") return;
  document.cookie = `${ACTIVE_CAMPAIGN_COOKIE}=${id ?? ""}; path=/; max-age=${
    id ? ONE_YEAR_SECONDS : 0
  }; samesite=lax`;
}
