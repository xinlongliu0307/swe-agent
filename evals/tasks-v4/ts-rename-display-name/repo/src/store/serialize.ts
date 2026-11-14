import type { User } from "../model/user.ts";

/** The stored JSON shape. Bump the version whenever the shape changes. */
export interface UserRecordV1 {
  version: 1;
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
}

export function toRecord(user: User): UserRecordV1 {
  return { version: 1, id: user.id, fullName: user.fullName, email: user.email, createdAt: user.createdAt };
}

export function fromRecord(record: UserRecordV1): User {
  if (record.version !== 1) throw new Error(`unsupported record version: ${record.version}`);
  return { id: record.id, fullName: record.fullName, email: record.email, createdAt: record.createdAt };
}
