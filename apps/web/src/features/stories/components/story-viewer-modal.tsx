'use client';

import { usePathname } from 'next/navigation';
import { StoryViewer } from './story-viewer';

// A modal slot keeps its last page when the app navigates somewhere it has no match for
// (e.g. a profile link inside the viewer), so the viewer hides itself once the address
// is no longer a story.
export function StoryViewerModal({ username }: { username: string }) {
  const pathname = usePathname();
  if (!pathname.startsWith('/stories/')) return null;
  return <StoryViewer username={username} />;
}
