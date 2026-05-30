import { Href, router } from 'expo-router';

export function safeBack(fallback: Href | string) {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback as Href);
}
