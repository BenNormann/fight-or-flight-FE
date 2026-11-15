/** The only UI entry point for features and the app shell. Vendor code stays behind it. */
import { lazy } from 'react'

/** Lazy: vaul is only downloaded on phones and tablets. */
export const BottomSheet = lazy(() => import('./BottomSheet'))
export type { BottomSheetProps } from './BottomSheet'
export { SHEET_PEEK_PX, SIDE_PANEL_PX } from './layout'
export { breakpointFor, useBreakpoint, useViewportHeight, type Breakpoint } from './media'
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
export { SearchBar, type SearchBarProps } from './SearchBar'
export { SegmentedControl, type SegmentedControlProps, type SegmentedOption } from './SegmentedControl'
export { SidePanel } from './SidePanel'
export { StatusPill } from './StatusPill'
export { THEME_MODES, nextThemeMode, resolveTheme, useTheme, useThemeController, type ThemeMode } from './theme'
export { Toaster } from './toast'
export { arrivalTime, dayLabel, formatClock, formatDistance, formatDuration } from './format'
export { CategoryIcon, PlaceIcon } from './icons'
