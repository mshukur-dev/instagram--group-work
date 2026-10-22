'use client';

import { Heart } from 'lucide-react';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react';
import { useFormatter } from 'next-intl';
import { useEffect, useState } from 'react';

// Placeholder people and photos, from the same services the seed uses
const slides = [
  {
    username: 'alex.morgan',
    avatar: 'https://i.pravatar.cc/80?img=10',
    photo: 'https://picsum.photos/seed/ig-login-1/450/800',
    likes: 2481,
  },
  {
    username: 'anna_cooks',
    avatar: 'https://i.pravatar.cc/80?img=32',
    photo: 'https://picsum.photos/seed/ig-login-2/450/800',
    likes: 918,
  },
  {
    username: 'leo.music',
    avatar: 'https://i.pravatar.cc/80?img=12',
    photo: 'https://picsum.photos/seed/ig-login-3/450/800',
    likes: 5207,
  },
  {
    username: 'mike.fit',
    avatar: 'https://i.pravatar.cc/80?img=53',
    photo: 'https://picsum.photos/seed/ig-login-4/450/800',
    likes: 1364,
  },
];

const STORY_MS = 6500;
const soft = { stiffness: 120, damping: 18, mass: 0.6 };

// A story that plays by itself, like the real viewer: progress bars, author, likes.
// The deck leans toward the pointer; the cards behind it are the previous and next story.
export function StoryDeck() {
  const reduceMotion = useReducedMotion();
  const format = useFormatter();
  const [index, setIndex] = useState(0);

  // Pointer position over the deck, from -0.5 to 0.5 on each axis
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const rotateY = useSpring(useTransform(pointerX, [-0.5, 0.5], [-12, 12]), soft);
  const rotateX = useSpring(useTransform(pointerY, [-0.5, 0.5], [10, -10]), soft);

  useEffect(() => {
    const timer = setTimeout(() => setIndex((i) => (i + 1) % slides.length), STORY_MS);
    return () => clearTimeout(timer);
  }, [index]);

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (reduceMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - rect.left) / rect.width - 0.5);
    pointerY.set((event.clientY - rect.top) / rect.height - 0.5);
  };

  const onPointerLeave = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  const slide = slides[index]!;
  const previous = slides[(index + slides.length - 1) % slides.length]!;
  const next = slides[(index + 1) % slides.length]!;

  return (
    <div
      aria-hidden="true"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className="relative h-115 w-120 perspective-distant"
    >
      {/* Soft story-ring glow behind the deck */}
      <div className="bg-aurora absolute inset-0 scale-125 rounded-full blur-3xl motion-safe:animate-[drift_9s_ease-in-out_infinite_alternate]" />

      <motion.div style={{ rotateX, rotateY }} className="relative size-full transform-3d">
        <BackCard photo={previous.photo} side="left" />
        <BackCard photo={next.photo} side="right" />

        <div className="absolute top-0 left-1/2 h-115 w-65 -translate-x-1/2 overflow-hidden rounded-[28px] bg-muted shadow-float-raised transform-[translateZ(60px)]">
          <AnimatePresence initial={false}>
            <motion.img
              key={slide.photo}
              src={slide.photo}
              alt=""
              initial={reduceMotion ? false : { opacity: 0, scale: 1.08 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 size-full object-cover"
            />
          </AnimatePresence>

          {/* Overlays sit on the photo, so they stay white in both themes */}
          <div className="absolute inset-x-0 top-0 h-24 bg-linear-to-b from-black/50 to-transparent" />

          <div className="absolute inset-x-3 top-3 flex gap-1">
            {slides.map((item, i) => (
              <span
                key={item.username}
                className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/35"
              >
                {i < index && <span className="block size-full bg-white" />}
                {i === index && (
                  <motion.span
                    key={index}
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: STORY_MS / 1000, ease: 'linear' }}
                    className="block h-full bg-white"
                  />
                )}
              </span>
            ))}
          </div>

          <div className="absolute top-7 left-3 flex items-center gap-2 text-sm font-semibold text-white">
            <span className="bg-story-ring rounded-full p-0.5">
              <img
                src={slide.avatar}
                alt=""
                className="size-8 rounded-full border-2 border-black/20 object-cover"
              />
            </span>
            {slide.username}
          </div>
        </div>

        {/* Floats in front of the story, as if it were stuck on the glass */}
        <motion.div
          animate={reduceMotion ? undefined : { y: [0, -8, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-10 left-14 flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-4 py-2 text-sm font-semibold shadow-float backdrop-blur-md transform-[translateZ(120px)]"
        >
          <motion.span
            key={index}
            initial={reduceMotion ? false : { scale: 0.4 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 12 }}
          >
            <Heart className="size-4 fill-destructive text-destructive" />
          </motion.span>
          {format.number(slide.likes)}
        </motion.div>
      </motion.div>
    </div>
  );
}

function BackCard({ photo, side }: { photo: string; side: 'left' | 'right' }) {
  return (
    <div
      className={
        side === 'left'
          ? 'absolute top-12 left-4 h-90 w-50 overflow-hidden rounded-3xl shadow-float -rotate-9'
          : 'absolute top-12 right-4 h-90 w-50 overflow-hidden rounded-3xl shadow-float rotate-9'
      }
    >
      <img src={photo} alt="" className="size-full object-cover opacity-80" />
    </div>
  );
}
