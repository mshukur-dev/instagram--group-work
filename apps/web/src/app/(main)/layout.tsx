import { BottomNav } from '@/components/layout/bottom-nav';
import { CallLayer } from '@/features/calls/components/call-layer';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { PostModalHost } from '@/features/posts/components/post-modal';
import { RealtimeBridge } from '@/features/direct/realtime-bridge';
import { CreatePostDialog } from '@/features/posts/create/components/create-post-dialog';

export default function MainLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  /** Story viewer opened over the page (@modal/(.)stories) */
  modal: React.ReactNode;
}) {
  return (
    <>
      <Sidebar />
      <TopBar />
      <main className="min-h-screen pl-31 max-md:pt-15 max-md:pb-12.5 max-md:pl-0">{children}</main>
      <BottomNav />
      <CreatePostDialog />
      <RealtimeBridge />
      <CallLayer />
      <PostModalHost />
      {modal}
    </>
  );
}
