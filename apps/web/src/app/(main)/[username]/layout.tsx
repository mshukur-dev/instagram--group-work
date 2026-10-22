import { ProfileLayout } from '@/features/profile/components/profile-layout';

export default async function UserLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return <ProfileLayout username={decodeURIComponent(username)}>{children}</ProfileLayout>;
}
