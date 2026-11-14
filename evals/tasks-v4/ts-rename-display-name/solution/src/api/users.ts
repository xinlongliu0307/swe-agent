import type { User } from "../model/user.ts";
import { inputName, type UserInput, validateUserInput } from "../model/validate.ts";
import type { UserStore } from "../store/userStore.ts";
import { clock } from "../util/clock.ts";
import { nextId } from "../util/ids.ts";
import { NotFoundError, ValidationError } from "./errors.ts";

export function createUser(store: UserStore, input: UserInput): User {
  const problems = validateUserInput(input);
  if (problems.length) throw new ValidationError(problems);
  const user: User = { id: nextId(), displayName: (inputName(input) as string).trim(), email: input.email as string, createdAt: clock.now() };
  store.save(user);
  return user;
}

export function getUser(store: UserStore, id: string): User {
  const user = store.get(id);
  if (!user) throw new NotFoundError(`no user ${id}`);
  return user;
}

export function renameUser(store: UserStore, id: string, displayName: string): User {
  const problems = validateUserInput({ displayName, email: getUser(store, id).email });
  if (problems.length) throw new ValidationError(problems);
  const user = { ...getUser(store, id), displayName: displayName.trim() };
  store.save(user);
  return user;
}

export function listUsers(store: UserStore): User[] {
  return store.list();
}
