/**
 * Traveller characters, keyed by `NavCharacterId`. Add one by writing a
 * `CharacterDef` next to `chevron.ts` and listing it here.
 */
import type { NavCharacterId } from '@/domain'
import { chevron } from './chevron'
import type { CharacterDef, ExtrudedCharacter } from './types'

export const characters: Record<string, CharacterDef> = {
  [chevron.id]: chevron,
}

/** The character to draw for an id: unknown ids, and model characters (no renderer yet), fall back to the chevron. */
export function characterFor(id: NavCharacterId): ExtrudedCharacter {
  const def = characters[id]
  return def?.kind === 'extruded' ? def : chevron
}

export { characterFeatures, lerpAngle, lerpLngLat, metresPerPx, placeRing } from './geometry'
export type { CharacterColors, CharacterDef, CharacterPart, ExtrudedCharacter, ModelCharacter } from './types'
