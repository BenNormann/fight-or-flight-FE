/** The only UI entry point for features and the app shell. Vendor code stays behind it. */
import { lazy } from 'react'

/** Lazy: the sheet and its gesture code load only on phones and tablets. */
export const BottomSheet = lazy(() => import('./BottomSheet'))
/** Lazy: sonner stays out of the first-paint bundle. Render inside Suspense. */
export const Toaster = lazy(() => import('./toast'))
export type { BottomSheetProps } from './BottomSheet'
export { SHEET_PEEK_PX, SIDE_PANEL_PX } from './layout'
export { breakpointFor, useBreakpoint, useViewportHeight, useVisualViewport, type Breakpoint } from './media'
export { notify, type NotifyOptions } from './notify'
export {
  ActionBar,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  IconButton,
  Keystone,
  ListRow,
  RiskBadge,
  Section,
  SwitchRow,
  ViewHeader,
  type ActionItem,
  type ButtonProps,
  type CardProps,
  type ChipProps,
  type ChipRowProps,
  type IconButtonProps,
  type ListRowProps,
  type SwitchRowProps,
  type ViewHeaderProps,
} from './primitives'
/** Lazy: Base UI's menu loads on first open. Render inside Suspense; `MenuTriggerStub` is the static stand-in. */
export const Menu = lazy(() => import('./Menu'))
export type { MenuEntry, MenuProps } from './Menu'
export { MenuTriggerStub } from './MenuTriggerStub'
export { SearchBar, type SearchBarProps } from './SearchBar'
export { SegmentedControl, type SegmentedControlProps, type SegmentedOption } from './SegmentedControl'
export { SidePanel } from './SidePanel'
export { THEME_MODES, nextThemeMode, resolveTheme, useTheme, useThemeController, type ThemeMode } from './theme'
export { arrivalTime, dayLabel } from './format'
/** Clock times: `formatTime` / `formatHour` from `@/lib/time`. Distances and durations: `@/lib/units`. */
export { CategoryIcon, PlaceIcon } from './icons'
