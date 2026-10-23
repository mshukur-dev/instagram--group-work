import { TopReelsFeed } from '@/features/reels/components/reels-feed';

export default async function TopReelRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TopReelsFeed startId={id} />;
}
