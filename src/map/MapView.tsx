/**
 * The ONLY map instance in the app. P0 placeholder: the map lane (P1) mounts MapLibre
 * plus the deck.gl overlay here and draws every LayerDef from ./layers/registry.
 */
export function MapView() {
  return (
    <div data-testid="map" className="absolute inset-0 grid place-items-center">
      <h1 className="text-lg font-semibold tracking-tight">Fight or Flight</h1>
    </div>
  )
}
