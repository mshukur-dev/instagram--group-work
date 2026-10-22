export const queryKeys = {
  me: () => ['me'],
  feed: () => ['feed'],
  post: (id: string) => ['post', id],
  storiesFeed: () => ['stories', 'feed'],
  profile: (username: string) => ['profile', username],
  profilePosts: (username: string, tab: string) => ['profile', username, 'posts', tab],
};
