import { PostPage } from '@/features/posts/components/post-page';

export default async function PostRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PostPage postId={id} />;
}
