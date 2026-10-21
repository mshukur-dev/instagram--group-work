import { Feed } from '@/features/posts/components/feed';
import { StoriesTray } from '@/features/stories/components/stories-tray';

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-[470px] py-6 max-md:py-2">
      <StoriesTray />
      <Feed />
    </div>
  );
}
