import { LiveViewer } from '@/features/live/components/live-viewer';

export default async function LiveRoute({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <LiveViewer username={decodeURIComponent(username)} />;
}
