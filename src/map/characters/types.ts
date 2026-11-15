import type { NavCharacterId } from '@/domain'

/**
 * A traveller character drawn at the navigation position.
 *
 * Units are "design px": 1 unit = 1 screen px. The renderer converts with the
 * map's metres per pixel at the current zoom, so the character keeps a
 * constant on-screen size. Local axes: +x right, +y forward (the heading).
 */
export type Vec2 = [x: number, y: number]

/** Which resolved colour a part takes (see `CharacterColors`). */
export type CharacterTone = 'body' | 'accent'

export interface CharacterPart {
  /** Outer ring, unclosed, in design px. Concave is fine. */
  ring: Vec2[]
  tone: CharacterTone
  /** Bottom and top of the extrusion, in design px. Ignored when drawn flat. */
  base: number
  height: number
}

/** Drawn with MapLibre `fill` (2D) and `fill-extrusion` (Iso, 3D). */
export interface ExtrudedCharacter {
  kind: 'extruded'
  id: NavCharacterId
  label: string
  /** 2D: flat parts. */
  flat: CharacterPart[]
  /** Iso: the same silhouette with visible thickness under the fixed iso camera. */
  iso: CharacterPart[]
  /** 3D: the full solid, lit by the map light, turns with the camera. */
  solid: CharacterPart[]
}

/**
 * Seam for mesh characters (GLB). Needs a MapLibre custom layer renderer that
 * does not exist yet; until it does, the registry falls back to `chevron`.
 */
export interface ModelCharacter {
  kind: 'model'
  id: NavCharacterId
  label: string
  url: string
  /** Model units to design px. */
  scale: number
  /** Flat stand-in for 2D. */
  flat: CharacterPart[]
}

export type CharacterDef = ExtrudedCharacter | ModelCharacter

export interface CharacterColors {
  body: string
  accent: string
}
