import { StoryViewer } from '@/features/stories/components/story-viewer';

// Full screen, outside the (main) layout: no sidebar around the stories
export default async function StoriesPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  // `key`: moving on to the next person starts the viewer again from their first story
  return <StoryViewer key={username} username={decodeURIComponent(username)} />;
}
