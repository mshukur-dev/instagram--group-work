import { Feed } from '@/features/posts/components/feed';
import { HomeFeed } from '@/features/posts/components/home-feed';
import { SuggestionsRail } from '@/features/profile/components/suggestions-rail';
import { StoriesTray } from '@/features/stories/components/stories-tray';

// The feed and, on wide screens, the "Suggested for you" column beside it, which stays put while
// the feed scrolls. From 1280px the pair is centered together; from 1536px the feed sits
// a little left of the page's center, near the sidebar, and the column in the middle of the
// empty space on its right.
export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-[calc(29.375rem+5rem+20rem)] items-start justify-center gap-20 py-6 max-md:py-2 2xl:grid 2xl:max-w-none 2xl:grid-cols-[0.8fr_29.375rem_1.2fr] 2xl:gap-0">
      <div className="w-full max-w-117.5 min-w-0 2xl:col-start-2">
        <HomeFeed>
          <StoriesTray />
          <Feed />
        </HomeFeed>
      </div>
      <SuggestionsRail className="sticky top-10 pt-3 max-xl:hidden 2xl:col-start-3 2xl:row-start-1 2xl:justify-self-center" />
    </div>
  );
}
