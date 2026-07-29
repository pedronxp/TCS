export function safeConsoleDestination(candidate: string | null | undefined) {
  return candidate?.startsWith('/app') ? candidate : '/app';
}
