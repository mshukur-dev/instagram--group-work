import { LocationPage } from '@/features/posts/components/location-page';

export default async function LocationRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LocationPage id={id} />;
}
