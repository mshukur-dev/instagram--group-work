import { BottomNav } from '@/components/layout/bottom-nav';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { CreatePostDialog } from '@/features/posts/create/components/create-post-dialog';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <TopBar />
      <main className="min-h-screen pl-[124px] max-md:pt-[60px] max-md:pb-[50px] max-md:pl-0">
        {children}
      </main>
      <BottomNav />
      <CreatePostDialog />
    </>
  );
}
