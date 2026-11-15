import type { CharacterPart, ExtrudedCharacter, Vec2 } from './types'

/** Arrowhead pointing forward (+y), about 28 px long, centred on the position. */
const OUTLINE: Vec2[] = [
  [0, 15],
  [11, -11],
  [0, -5],
  [-11, -11],
]

/** Narrow spine along the centre line, raised above the body in 3D. */
const SPINE: Vec2[] = [
  [0, 12],
  [2.5, -1],
  [0, -3],
  [-2.5, -1],
]

const part = (ring: Vec2[], tone: CharacterPart['tone'], base: number, height: number): CharacterPart => ({ ring, tone, base, height })

export const chevron: ExtrudedCharacter = {
  kind: 'extruded',
  id: 'chevron',
  label: 'Arrow',
  flat: [part(OUTLINE, 'body', 0, 0), part(SPINE, 'accent', 0, 0)],
  iso: [part(OUTLINE, 'body', 0, 5)],
  solid: [part(OUTLINE, 'body', 0, 7), part(SPINE, 'accent', 7, 10)],
}
