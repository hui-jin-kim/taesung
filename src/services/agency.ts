export type AgencyProfile = {
  name: string;
  representative?: string;
  logoUrl?: string;
  phones: string[];
  address?: string;
  businessNo?: string;
  ctaText?: string;
  ctaLink?: string;
};

const KEY = 'rj_agency_profile';

export function getAgencyProfile(): AgencyProfile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AgencyProfile;
  } catch { return null; }
}

