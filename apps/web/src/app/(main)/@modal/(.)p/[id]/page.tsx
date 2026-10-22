import { PostModal } from '@/features/posts/components/post-modal';

// Opened from inside the app, a post lies over the current page (the feed or a profile stays
// underneath, scroll position included). A direct link or a reload uses app/(main)/p/[id].
export default async function PostModalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PostModal postId={id} />;
}
