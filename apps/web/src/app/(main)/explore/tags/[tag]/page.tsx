import { HashtagPage } from '@/features/search/components/hashtag-page';

export default async function HashtagRoute({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;
  return <HashtagPage name={decodeURIComponent(tag)} />;
}
