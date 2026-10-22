export const queryKeys = {
  me: () => ['me'],
  feed: () => ['feed'],
  post: (id: string) => ['post', id],
  comments: (postId: string) => ['comments', postId],
  replies: (commentId: string) => ['replies', commentId],
  likers: (postId: string, q: string) => ['likers', postId, q],
  storiesFeed: () => ['stories', 'feed'],
  userStories: (username: string) => ['stories', 'user', username],
  storyViewers: (storyId: string) => ['stories', 'viewers', storyId],
  profile: (username: string) => ['profile', username],
  profilePosts: (username: string, tab: string) => ['profile', username, 'posts', tab],
  followList: (username: string, kind: string, q: string) => ['profile', username, kind, q],
};
