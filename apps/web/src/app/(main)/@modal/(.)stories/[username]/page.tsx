import { StoryViewerModal } from '@/features/stories/components/story-viewer-modal';

// Opened from inside the app, the viewer lies over the current page instead of replacing it:
// the feed stays underneath (scroll position included) and shows again on close.
// A direct link or a reload uses the full page in app/stories/[username].
export default async function StoriesModal({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <StoryViewerModal username={decodeURIComponent(username)} />;
}
