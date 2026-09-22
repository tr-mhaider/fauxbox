// Tiny className joiner. Falsy values drop out; no dependency needed for the
// small conditional-class patterns this app uses.
export type ClassValue = string | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
