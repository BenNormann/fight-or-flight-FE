/**
 * Block characters authored in Blender (tools/blender/characters.py), which writes models.json:
 * each character is a table of boxes, and a walking character has more than one frame.
 * Here the boxes become the extruded parts the map draws. Do not edit models.json by hand:
 * change the script and run it again.
 */
import data from './models.json'
import type { CharacterPart, ExtrudedCharacter, Vec2 } from './types'

interface Box {
  tone: string
  x: number[]
  y: number[]
  z: number[]
}

/** Fixed colours for model tones (wood, bronze, ...). `body` and `accent` stay theme colours. */
export const TONE_HEX: Record<string, string> = data.tones

const rect = ([x0, x1]: number[], [y0, y1]: number[]): Vec2[] => [
  [x0!, y0!],
  [x1!, y0!],
  [x1!, y1!],
  [x0!, y1!],
]

/** The full solid: every box is one extrusion from its bottom to its top. */
const solid = (boxes: Box[]): CharacterPart[] => boxes.map((b) => ({ ring: rect(b.x, b.y), tone: b.tone, base: b.z[0]!, height: b.z[1]! }))

/** Seen from straight above: the same boxes, flat, lowest first so the higher ones paint over them. */
const flat = (boxes: Box[]): CharacterPart[] =>
  [...boxes].sort((a, b) => a.z[1]! - b.z[1]!).map((b) => ({ ring: rect(b.x, b.y), tone: b.tone, base: 0, height: 0 }))

export const modelCharacters: ExtrudedCharacter[] = data.characters.map((c) => {
  const frames = c.frames as Box[][]
  const first = frames[0]!
  return {
    kind: 'extruded',
    id: c.id,
    label: c.label,
    flat: flat(first),
    iso: solid(first),
    solid: solid(first),
    outlineAll: true,
    ...(frames.length > 1 && c.strideM > 0 ? { walk: { strideM: c.strideM, flat: frames.map(flat), solid: frames.map(solid) } } : {}),
  }
})
