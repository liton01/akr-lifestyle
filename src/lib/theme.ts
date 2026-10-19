/** Storefront colour theme. Light is the default; the visitor's choice is kept in a cookie. */
export type Theme = "light" | "dark";

export const THEME_COOKIE = "akr-theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function parseTheme(value: string | undefined): Theme {
  return value === "dark" ? "dark" : "light";
}
