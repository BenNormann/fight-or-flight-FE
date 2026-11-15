/**
 * A flat yellow Corinthian-style helmet worn by the signed-in avatar, seen from the front:
 * an upright crest, a domed shell and two cheek guards. The eye band and the slit between
 * the cheek guards are cut wide so the account letter stays readable through them.
 * One solid shape with a dark outline around the outside, no inner detail. Original drawing; decorative (the button carries the label).
 *
 * Scales with the avatar: the box overhangs it by a quarter of its width each side and
 * a little under half its height on top.
 */
export function HelmetMark() {
  return (
    <svg
      aria-hidden
      viewBox="0 -6 48 54"
      // Sized relative to the avatar (32 units of the 48×54 box), so the avatar can be any size.
      className="pointer-events-none absolute -top-[43.75%] -left-1/4 h-[168.75%] w-[150%] max-w-none overflow-visible drop-shadow-[0_1px_1.5px_rgb(0_0_0/0.45)]"
      fill="var(--gold)"
    >
      <path d="M19.500 6 17-5h14L28.500 6C36.500 7.800 42 14.500 42 24v7c0 6.500-3.500 12-11 16L30 27h4c2.200 0 3.500-2 3.500-4.500 0-2.800-2-5-4.500-5h-6.500L24 19.500 21.500 17.500H15c-2.500 0-4.500 2.200-4.500 5 0 2.500 1.300 4.500 3.500 4.500h4L17 47C9.500 43 6 37.500 6 31v-7C6 14.500 11.500 7.800 19.500 6Z" />
      {/* Dark outline on the outer silhouette only (cheek tip, dome, crest, other cheek tip); the face opening stays unlined. */}
      <path
        d="M17 47C9.500 43 6 37.500 6 31v-7C6 14.500 11.500 7.800 19.500 6L17-5h14L28.500 6C36.500 7.800 42 14.500 42 24v7c0 6.500-3.500 12-11 16"
        fill="none"
        stroke="var(--gold-foreground)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
