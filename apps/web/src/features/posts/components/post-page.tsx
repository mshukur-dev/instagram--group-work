'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { usePost } from '../queries';
import { PostDetail } from './post-detail';
import { PostUnavailable } from './post-unavailable';

const ease = [0.22, 1, 0.36, 1] as const;

function PostSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto aspect-4/5 w-full max-w-117.5 animate-pulse rounded-2xl bg-muted"
    />
  );
}

// POST-6: /p/:id as a page of its own, for a direct link or a reload. Inside the app the same
// post opens as a modal over the feed or the profile (app/(main)/@modal).
export function PostPage({ postId }: { postId: string }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { data: post, error } = usePost(postId);

  return (
    <div className="mx-auto flex w-fit max-w-full justify-center px-6 py-6 max-md:w-full max-md:px-0 max-md:py-0">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="max-md:w-full"
      >
        {post ? (
          <PostDetail post={post} variant="page" onDeleted={() => router.replace('/')} />
        ) : error ? (
          <PostUnavailable error={error} />
        ) : (
          <PostSkeleton />
        )}
      </motion.div>
    </div>
  );
}
