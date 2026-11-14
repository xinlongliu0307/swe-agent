let counter = 0;

/** Short sequential ids such as "ord-1". */
export function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}
