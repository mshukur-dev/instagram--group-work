import { ProfileGrid } from '@/features/profile/components/profile-grid';

export default async function ProfilePostsPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return <ProfileGrid username={decodeURIComponent(username)} tab="posts" />;
}
