// A populated Mongoose ref shows up in exactly three shapes depending on the endpoint and
// on whether the referenced document still exists: a bare id string (not populated), a
// populated object ({_id, name, ...}), or `null`/`undefined` (populated but the target was
// deleted - Mongoose resolves a dangling ref to null rather than omitting the field or
// erroring). Code across this app repeatedly handled only the first two cases, which crashed
// hard - "Cannot read properties of null" - the moment a referenced user/player was actually
// deleted (e.g. a team whose captain's account was removed, a follow relationship pointing at
// a deleted user). Centralized here so every call site gets the third case handled the same
// way, instead of nine slightly-different inline checks each missing it.

type PopulatedRef<T extends { _id: string }> = T | string | null | undefined;

/** The referenced document's id, or null if the ref is missing/dangling. */
export function resolveRefId<T extends { _id: string }>(ref: PopulatedRef<T>): string | null {
  if (!ref) return null;
  return typeof ref === 'string' ? ref : ref._id;
}

/**
 * A display name for the referenced document, or `fallback` if the ref is missing/dangling
 * or (being just an unpopulated id string) has no name to show.
 */
export function resolveRefName<T extends { _id: string; name?: string }>(
  ref: PopulatedRef<T>,
  fallback: string = 'Unknown'
): string {
  if (!ref) return fallback;
  if (typeof ref === 'string') return fallback;
  return ref.name || fallback;
}
