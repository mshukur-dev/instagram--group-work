import { Feed } from '@/features/posts/components/feed';
import { SuggestionsRail } from '@/features/profile/components/suggestions-rail';
import { StoriesTray } from '@/features/stories/components/stories-tray';

// The feed and, on wide screens, the "Suggested for you" column beside it: the pair is centered
// together (so the feed sits left of center), and the column stays put while the feed scrolls.
export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-[calc(29.375rem+4rem+20rem)] items-start justify-center gap-16 py-6 max-md:py-2">
      <div className="w-full max-w-117.5 min-w-0">
        <StoriesTray />
        <Feed />
      </div>
      <SuggestionsRail className="sticky top-10 pt-2 max-xl:hidden" />
    </div>
  );
}
