export function safeConsoleDestination(candidate: string | null | undefined) {
  if (!candidate?.startsWith('/') || candidate.startsWith('//')) return '/app';
  try {
    const url = new URL(candidate, 'https://console.tcs.local');
    const allowed = url.pathname === '/app' || url.pathname.startsWith('/app/');
    return allowed ? `${url.pathname}${url.search}${url.hash}` : '/app';
  } catch {
    return '/app';
  }
}
