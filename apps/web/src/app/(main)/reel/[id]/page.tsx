import { ReelsFeed } from '@/features/reels/components/reels-feed';

export default async function ReelRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReelsFeed firstId={id} />;
}
