export const queryKeys = {
  me: () => ['me'],
  feed: () => ['feed'],
  post: (id: string) => ['post', id],
  storiesFeed: () => ['stories', 'feed'],
};
