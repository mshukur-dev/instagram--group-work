import { Thread } from '@/features/direct/components/thread';

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // A new chat starts fresh: no leftover reply or scroll from the previous one
  return <Thread key={id} id={id} />;
}
