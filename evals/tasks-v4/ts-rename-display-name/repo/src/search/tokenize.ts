/** Lower-case word tokens; an email also yields its local part and domain. */
export function tokens(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}
