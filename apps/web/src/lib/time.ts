export type TimeUnit = 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks';

// Instagram-style short time: 2h, 3d, 1w. The text comes from the "time" translations.
export function shortTimeAgo(date: string): { unit: TimeUnit; count: number } {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));

  if (seconds < 60) return { unit: 'seconds', count: seconds };
  if (seconds < 3600) return { unit: 'minutes', count: Math.floor(seconds / 60) };
  if (seconds < 86400) return { unit: 'hours', count: Math.floor(seconds / 3600) };
  if (seconds < 604800) return { unit: 'days', count: Math.floor(seconds / 86400) };
  return { unit: 'weeks', count: Math.floor(seconds / 604800) };
}
