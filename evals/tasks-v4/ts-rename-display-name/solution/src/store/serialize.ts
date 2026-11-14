import type { User } from "../model/user.ts";

/** The stored JSON shapes. Bump the version whenever the shape changes. */
export interface UserRecordV1 {
  version: 1;
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
}

export interface UserRecordV2 {
  version: 2;
  id: string;
  displayName: string;
  email: string;
  createdAt: string;
}

export type UserRecord = UserRecordV1 | UserRecordV2;

export function toRecord(user: User): UserRecordV2 {
  return { version: 2, id: user.id, displayName: user.displayName, email: user.email, createdAt: user.createdAt };
}

/** Reads both versions; version 1 records name the field fullName. */
export function fromRecord(record: UserRecord): User {
  if (record.version === 2)
    return { id: record.id, displayName: record.displayName, email: record.email, createdAt: record.createdAt };
  if (record.version === 1)
    return { id: record.id, displayName: record.fullName, email: record.email, createdAt: record.createdAt };
  throw new Error(`unsupported record version: ${(record as { version: unknown }).version}`);
}
