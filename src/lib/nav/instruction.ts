/** Instruction text for a route step. Pure. Sentence case, no hyphens (docs/DESIGN.md voice). */
import type { Maneuver, RouteStep } from '@/domain'

const COMPASS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'] as const

export function compassWord(deg: number): (typeof COMPASS)[number] {
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8]!
}

const VERB: Record<Exclude<Maneuver, 'depart' | 'arrive'>, string> = {
  straight: 'Continue',
  'slight-left': 'Bear left',
  left: 'Turn left',
  'sharp-left': 'Turn sharp left',
  'slight-right': 'Bear right',
  right: 'Turn right',
  'sharp-right': 'Turn sharp right',
  'u-turn': 'Make a U turn',
}

export interface InstructionContext {
  /** Where the route ends, for the arrive step. */
  destinationName?: string
  /** Direction of the first leg, for the depart step. */
  departBearingDeg?: number
}

/** "Turn left onto Trousdale Pkwy", "Head north on Trousdale Pkwy", "Arrive at Doheny Memorial Library". */
export function stepInstruction(step: RouteStep, ctx: InstructionContext = {}): string {
  if (step.maneuver === 'arrive') return ctx.destinationName ? `Arrive at ${ctx.destinationName}` : 'Arrive at your destination'
  if (step.maneuver === 'depart') {
    const dir = ctx.departBearingDeg !== undefined ? ` ${compassWord(ctx.departBearingDeg)}` : ''
    return step.name ? `Head${dir} on ${step.name}` : `Head${dir}`
  }
  const verb = VERB[step.maneuver]
  return step.name ? `${verb} onto ${step.name}` : verb
}
