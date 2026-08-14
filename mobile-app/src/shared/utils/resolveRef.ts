// A populated Mongoose ref shows up in exactly three shapes depending on the endpoint and on
// whether the referenced document still exists: a bare id string (not populated), a populated
// object ({_id, name, ...}), or `null`/`undefined` (populated but the target was deleted -
// Mongoose resolves a dangling ref to null rather than omitting the field or erroring). Mobile
// screens repeatedly handled only the first two cases via `typeof x === 'string' ? fallback :
// x.name` - `typeof null === 'object'`, so a dangling ref falls through to `x.name` and crashes
// with "Cannot read property 'name' of null" (confirmed crash: HomeScreen.tsx's recent-matches
// list, when a match references a deleted team). Mirrors web-app/lib/resolveRef.ts - same bug,
// same fix, ported here since mobile has its own 24 independent inline copies of this pattern
// across 13 screens rather than one shared web-app/lib module.

type PopulatedRef<T extends { _id: string }> = T | string | null | undefined;

/** The referenced document's id, or null if the ref is missing/dangling. */
export function resolveRefId<T extends { _id: string }>(ref: PopulatedRef<T>): string | null {
  if (!ref) return null;
  return typeof ref === 'string' ? ref : ref._id;
}

/**
 * A display name for the referenced document, or `fallback` if the ref is missing/dangling or
 * (being just an unpopulated id string) has no name to show. Deliberately only requires `.name`
 * (not `._id`, unlike resolveRefId above) - mobile's `User` type uses `id` rather than `_id`
 * (it mirrors the auth API's response shape, not a raw Mongoose document), so tying this to the
 * `_id` convention would make it unusable for User-typed refs like Player.user/Match.createdBy.
 */
export function resolveRefName<T extends { name?: string }>(
  ref: T | string | null | undefined,
  fallback: string = 'Unknown'
): string {
  if (!ref) return fallback;
  if (typeof ref === 'string') return fallback;
  return ref.name || fallback;
}
