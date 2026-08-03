// components/ui/index.ts
// Barrel export de todos os componentes do Design System
// Uso: import { Card, Button, Badge } from '../../components/ui';

export { Card } from './Card';
export type { CardProps, CardVariant } from './Card';
export { Button } from './Button';
export type { ButtonProps, ButtonSize, ButtonVariant } from './Button';
export { Badge } from './Badge';
export type { BadgeVariant, RiscoLevel, UserRole } from './Badge';
export { RISCO_LABELS } from './Badge';
export { EmptyState } from './EmptyState';
export { LoadingState } from './LoadingState';
export { ErrorState } from './ErrorState';
export { SectionHeader } from './SectionHeader';
export { Screen } from './Screen';
export type { ScreenProps } from './Screen';
export { AppHeader } from './AppHeader';
export type { AppHeaderProps } from './AppHeader';
export { FormField } from './FormField';
export type { FormFieldProps } from './FormField';
export { FlowProgress } from './FlowProgress';
export type { FlowProgressProps } from './FlowProgress';
export { ListRow } from './ListRow';
export type { ListRowProps } from './ListRow';
export { MetricCard } from './MetricCard';
export type { MetricCardProps } from './MetricCard';
export { ModuleCard } from './ModuleCard';
export type { ModuleCardProps } from './ModuleCard';
export { StateBanner } from './StateBanner';
export type { StateBannerProps, StateBannerVariant } from './StateBanner';
export { ConfirmSheet } from './ConfirmSheet';
export type { ConfirmSheetAction, ConfirmSheetProps } from './ConfirmSheet';
