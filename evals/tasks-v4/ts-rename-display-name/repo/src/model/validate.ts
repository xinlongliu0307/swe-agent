import { MAX_NAME_LENGTH } from "./user.ts";

export interface UserInput {
  fullName?: unknown;
  email?: unknown;
}

/** Problems with input for a new user; empty when it is valid. */
export function validateUserInput(input: UserInput): string[] {
  const problems: string[] = [];
  if (typeof input.fullName !== "string" || !input.fullName.trim()) problems.push("fullName is required");
  else if (input.fullName.length > MAX_NAME_LENGTH) problems.push(`fullName is longer than ${MAX_NAME_LENGTH}`);
  if (typeof input.email !== "string" || !/^[^@\s]+@[^@\s]+$/.test(input.email)) problems.push("email is invalid");
  return problems;
}
