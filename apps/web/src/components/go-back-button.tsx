'use client';

import { useRouter } from 'next/navigation';

// Back in the browser history; if the page was opened directly there is nothing to go back to,
// so it leads to the feed instead.
export function GoBackButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push('/'))}
      className={className}
    >
      {children}
    </button>
  );
}
