export const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? "";

export type CaptchaTokenOptions = {
  captchaToken?: string;
};

export function captchaTokenOptions(
  siteKey: string,
  token: string | null,
): CaptchaTokenOptions {
  if (!siteKey) return {};
  if (!token) throw new Error("Complete the security check before continuing.");
  return { captchaToken: token };
}
