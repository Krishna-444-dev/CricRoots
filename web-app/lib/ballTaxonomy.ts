// Shared delivery/shot tagging taxonomy for live scoring, commentary generation, and the
// voice-input parser. The actual enum source of truth is the Mongoose schema in
// backend/src/models/Match.js (ball subdocument, ~lines 70-106) - Mongoose enforces those
// enums server-side, and there's no automated check keeping this file in sync with it, so a
// future backend enum change needs a matching manual update here.

export type Line = 'wide-outside-off' | 'outside-off' | 'off-stump' | 'middle-stump' | 'leg-stump' | 'down-leg' | 'unknown';
export type Length = 'full-toss' | 'yorker' | 'full' | 'good-length' | 'short-of-good-length' | 'short' | 'bouncer' | 'unknown';
export type ShotType = 'defensive' | 'drive' | 'cut' | 'pull-hook' | 'sweep' | 'flick-glance' | 'loft' | 'reverse-scoop' | 'edge' | 'other';
export type ShotZone = 'fine-leg' | 'square-leg' | 'mid-wicket' | 'mid-on' | 'mid-off' | 'cover' | 'point' | 'third-man';
export type FielderPosition = ShotZone | 'wicket-keeper' | 'bowler' | 'not-applicable';

export const LINES: Line[] = ['wide-outside-off', 'outside-off', 'off-stump', 'middle-stump', 'leg-stump', 'down-leg'];
export const LENGTHS: Length[] = ['full-toss', 'yorker', 'full', 'good-length', 'short-of-good-length', 'short', 'bouncer'];
export const SHOT_TYPES: ShotType[] = ['defensive', 'drive', 'cut', 'pull-hook', 'sweep', 'flick-glance', 'loft', 'reverse-scoop', 'edge', 'other'];
// Batsman-relative wagon-wheel order (off side -> straight -> leg side); labels alone carry the
// batsman-relative meaning ("cover" is always the batsman's own cover, left- or right-handed).
export const SHOT_ZONES: ShotZone[] = ['third-man', 'point', 'cover', 'mid-off', 'mid-on', 'mid-wicket', 'square-leg', 'fine-leg'];

export function labelize(value: string): string {
  return value
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
