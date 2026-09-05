/** Optional pay-what-you-want tip jar (home screen only). Swap TIP_LINKS for live Payment Links. */
export const TIP_LINKS = {
  1: "https://donate.stripe.com/test_6oU4grazO8Hz1GmekI5EY00",
  5: "https://donate.stripe.com/test_28E6ozeQ4bTL98O90o5EY01",
  10: "https://donate.stripe.com/test_28EdR18rGcXPbgWb8w5EY02",
  custom: "https://donate.stripe.com/test_8x29AL4bq7Dv3Ou0tS5EY03",
} as const;

export type TipAmount = 1 | 5 | 10 | "custom";

/** Open a Stripe tip link. Custom amounts are entered on Stripe's hosted page. */
export function tipUrl(amount: TipAmount): string {
  return TIP_LINKS[amount];
}

export function openTip(amount: TipAmount): void {
  const url = tipUrl(amount);
  window.open(url, "_blank", "noopener,noreferrer");
}
