export const SEDI_PUBLIC_BASE_URL = "https://sedibawellnessclinic.co.za";

export function sediPublicUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${SEDI_PUBLIC_BASE_URL}${normalizedPath}`;
}

export const SEDI_CONSULTATION_URL = sediPublicUrl("/book-consultation");