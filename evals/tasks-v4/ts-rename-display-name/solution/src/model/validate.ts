import { MAX_NAME_LENGTH } from "./user.ts";

export interface UserInput {
  displayName?: unknown;
  /** Legacy name of displayName, still accepted from API clients for one release. */
  fullName?: unknown;
  email?: unknown;
}

/** The display name from input: displayName, or the legacy fullName when displayName is absent. */
export function inputName(input: UserInput): unknown {
  return input.displayName !== undefined ? input.displayName : input.fullName;
}

/** Problems with input for a new user; empty when it is valid. */
export function validateUserInput(input: UserInput): string[] {
  const problems: string[] = [];
  const name = inputName(input);
  if (typeof name !== "string" || !name.trim()) problems.push("displayName is required");
  else if (name.length > MAX_NAME_LENGTH) problems.push(`displayName is longer than ${MAX_NAME_LENGTH}`);
  if (typeof input.email !== "string" || !/^[^@\s]+@[^@\s]+$/.test(input.email)) problems.push("email is invalid");
  return problems;
}
