import { ConsoleShell } from '@/components/layout/ConsoleShell';
import { LegacyConsoleShell } from '@/components/layout/LegacyConsoleShell';

export const AppLayout = import.meta.env.VITE_NEW_CONSOLE_UI === 'false' ? LegacyConsoleShell : ConsoleShell;
