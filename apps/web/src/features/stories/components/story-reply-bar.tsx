'use client';

import type { Story } from '@instagram/shared';
import { Heart, Send } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { useReplyToStory } from '@/features/direct/queries';
import { cn } from '@/lib/utils';

const QUICK = ['😂', '😮', '😍', '😢', '👏', '🔥', '🎉', '💯'];

type Props = {
  story: Story;
  /** While typing the story stands still */
  onActiveChange: (active: boolean) => void;
};

// STORY-6: the bottom of someone else's story. "Reply to …" sends a message to the 1:1 chat
// with them (with a picture of the story); focusing it pauses the story and slides in a row of
// quick reactions that go with one tap; the heart sends a ❤️.
export function StoryReplyBar({ story, onActiveChange }: Props) {
  const t = useTranslations('stories.reply');
  const reduceMotion = useReducedMotion();
  const reply = useReplyToStory();
  const field = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [flying, setFlying] = useState<{ id: number; emoji: string } | null>(null);

  const setActive = (active: boolean) => {
    setFocused(active);
    onActiveChange(active);
  };

  const send = (value: string, emoji?: string) => {
    const body = value.trim();
    if (!body || reply.isPending) return;
    if (emoji && !reduceMotion) setFlying({ id: Date.now(), emoji });
    reply.mutate(
      { authorId: story.author.id, storyId: story.id, text: body },
      {
        onSuccess: () => toast.success(t('sent', { username: story.author.username })),
        onError: () => toast.error(t('failed')),
      },
    );
    setText('');
    field.current?.blur();
  };

  return (
    <div
      // Clicks here are not taps on the story
      onPointerDown={(event) => event.stopPropagation()}
      className="absolute inset-x-0 bottom-0 z-10 bg-linear-to-t from-black/60 via-black/25 to-transparent px-3 pt-10 pb-3 max-md:pb-[max(env(safe-area-inset-bottom),12px)]"
    >
      {/* Quick reactions, while the field is open */}
      <AnimatePresence>
        {focused && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ type: 'spring', stiffness: 520, damping: 34 }}
            className="mb-3 grid grid-cols-8 gap-1"
          >
            {QUICK.map((emoji, i) => (
              <motion.button
                key={emoji}
                type="button"
                // keep the field focused until the tap lands
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => send(emoji, emoji)}
                aria-label={t('react', { emoji })}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 600, damping: 22, delay: i * 0.025 }}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.85 }}
                className="grid aspect-square place-items-center rounded-full text-[28px] outline-none focus-visible:ring-2 focus-visible:ring-white/60 max-md:text-2xl"
              >
                {emoji}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          send(text);
        }}
        className="flex items-center gap-2"
      >
        <input
          ref={field}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onFocus={() => setActive(true)}
          onBlur={() => setActive(false)}
          onKeyDown={(event) => {
            // Typing is not story navigation (arrows, Space) and Esc only leaves the field
            event.stopPropagation();
            if (event.key === 'Escape') field.current?.blur();
          }}
          placeholder={t('placeholder', { username: story.author.username })}
          aria-label={t('placeholder', { username: story.author.username })}
          maxLength={1000}
          className={cn(
            'h-11 min-w-0 flex-1 rounded-full border bg-transparent px-4 text-sm text-white outline-none transition-colors placeholder:text-white/80',
            focused ? 'border-white bg-black/20' : 'border-white/60',
          )}
        />
        <AnimatePresence mode="popLayout" initial={false}>
          {text.trim() ? (
            <motion.button
              key="send"
              type="submit"
              disabled={reply.isPending}
              aria-label={t('send')}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              whileTap={{ scale: 0.88 }}
              className="grid size-11 shrink-0 place-items-center rounded-full text-white outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <Send className="size-6" />
            </motion.button>
          ) : (
            <motion.button
              key="heart"
              type="button"
              onClick={() => send('❤️', '❤️')}
              aria-label={t('like')}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              whileTap={{ scale: 0.8 }}
              className="grid size-11 shrink-0 place-items-center rounded-full text-white outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <Heart className="size-7" />
            </motion.button>
          )}
        </AnimatePresence>
      </form>

      {/* The chosen reaction flies up and fades, like it was sent into the story */}
      <AnimatePresence>
        {flying && (
          <motion.span
            key={flying.id}
            aria-hidden="true"
            initial={{ y: 0, scale: 0.6, opacity: 0 }}
            animate={{ y: -260, scale: [0.6, 1.8, 1.4], opacity: [0, 1, 0] }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            onAnimationComplete={() => setFlying(null)}
            className="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 text-5xl"
          >
            {flying.emoji}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
