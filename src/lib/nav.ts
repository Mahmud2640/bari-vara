import { useCallback } from 'react';
import { useRouter } from 'expo-router';

// "Back" that still works when a screen was opened directly (a reload on web): falls back to Home.
export function useGoBack(): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/home');
  }, [router]);
}
