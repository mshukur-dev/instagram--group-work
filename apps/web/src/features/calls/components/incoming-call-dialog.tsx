'use client';

import { Phone, PhoneOff, Video } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { UserAvatar } from '@/components/user-avatar';
import { cldUrl } from '@/lib/cloudinary';
import { startRingtone } from '@/lib/tones';
import { useIsClient } from '@/lib/use-is-client';
import { useCallStore } from '../call-store';
import { useCallActions } from '../queries';

// Where the color blobs sit in the card (story ring tokens from globals.css)
const BLOBS = [
  { color: '--story-ring-4', place: { top: '-20%', left: '-25%' } },
  { color: '--story-ring-3', place: { top: '-10%', right: '-30%' } },
  { color: '--story-ring-2', place: { bottom: '-25%', left: '-10%' } },
  { color: '--story-ring-5', place: { bottom: '-20%', right: '-25%' } },
];

// CALL-3: a 1:1 call ringing for me. A night card where the story colors drift, the caller
// inside a turning story ring with colored ripples going out like sound; Decline on the left,
// Accept on the right.
export function IncomingCallDialog() {
  const incoming = useCallStore((s) => s.incoming);
  const { accept, decline } = useCallActions();
  const t = useTranslations('calls');
  const reduceMotion = useReducedMotion();
  const isClient = useIsClient();

  useEffect(() => {
    if (!incoming) return;
    const stop = startRingtone();
    return stop;
  }, [incoming]);

  if (!isClient) return null;
  const caller = incoming?.caller;
  const video = incoming?.call.type === 'VIDEO';
  const avatar = caller?.avatarUrl ? cldUrl(caller.avatarUrl, 'w_200,f_auto,q_auto') : null;

  return createPortal(
    <AnimatePresence>
      {incoming && caller && (
        <motion.div
          key={incoming.call.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-95 grid place-items-center bg-black/75 p-4 backdrop-blur-md backdrop-saturate-50 max-md:p-0"
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-label={t(video ? 'incomingVideo' : 'incomingAudio')}
            initial={{ opacity: 0, scale: 0.9, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="relative isolate flex w-full max-w-90 flex-col items-center overflow-hidden rounded-[32px] bg-call-night px-6 pt-11 pb-8 text-white shadow-[0_40px_90px_-24px_rgb(0_0_0/0.75)] max-md:h-dvh max-md:max-w-none max-md:justify-between max-md:rounded-none max-md:pt-28 max-md:pb-16"
          >
            {/* The story colors drifting in the night, with the caller's photo woven into
                them (luminosity only, so even a gray photo turns into color) */}
            <span aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden">
              {BLOBS.map((blob, i) => (
                <span
                  key={i}
                  className="absolute size-[70%] rounded-full opacity-55 blur-2xl motion-safe:animate-call-drift"
                  style={{
                    ...blob.place,
                    background: `radial-gradient(circle, var(${blob.color}) 0%, transparent 68%)`,
                    animationDelay: `${i * -2.3}s`,
                  }}
                />
              ))}
              {avatar && (
                <img
                  src={avatar}
                  alt=""
                  className="absolute inset-0 size-full scale-150 object-cover opacity-35 mix-blend-luminosity blur-2xl"
                />
              )}
              <span className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-call-night/80" />
            </span>
            {/* Thin light edge, like glass */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-white/12 ring-inset"
            />

            <div className="flex flex-col items-center">
              <span className="relative grid size-29.5 place-items-center">
                {/* Ripples in the story colors, going out like the sound of a ring */}
                {!reduceMotion &&
                  [0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full bg-story-conic blur-md"
                      initial={{ scale: 0.9, opacity: 0.45 }}
                      animate={{ scale: 2, opacity: 0 }}
                      transition={{
                        duration: 2.7,
                        repeat: Infinity,
                        delay: i * 0.9,
                        ease: 'easeOut',
                      }}
                    />
                  ))}
                {/* The story ring itself, slowly turning */}
                <motion.span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full bg-story-conic"
                  animate={reduceMotion ? undefined : { rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                />
                <span className="relative rounded-full bg-call-night p-1">
                  <UserAvatar src={caller.avatarUrl} alt="" size={104} />
                </span>
              </span>
              <p className="mt-7 text-[22px] leading-tight font-semibold tracking-tight">
                {caller.username}
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-white/70">
                {video ? <Video className="size-4" /> : <Phone className="size-3.5" />}
                {t(video ? 'incomingVideo' : 'incomingAudio')}
              </p>
            </div>

            <div className="mt-11 flex w-full justify-around">
              <RoundAction
                label={t('decline')}
                onClick={() => decline(incoming)}
                className="bg-destructive shadow-destructive/40"
              >
                <PhoneOff className="size-7" />
              </RoundAction>
              <RoundAction
                label={t('accept')}
                onClick={() => void accept(incoming)}
                className="bg-emerald-500 shadow-emerald-500/45"
                autoFocus
                wiggle={!reduceMotion}
              >
                {video ? <Video className="size-7" /> : <Phone className="size-7" />}
              </RoundAction>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function RoundAction({
  label,
  onClick,
  className,
  autoFocus,
  wiggle,
  children,
}: {
  label: string;
  onClick: () => void;
  className: string;
  autoFocus?: boolean;
  wiggle?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className="relative flex flex-col items-center gap-2">
      {/* The answer button breathes a soft glow */}
      {wiggle && (
        <motion.span
          aria-hidden="true"
          className="absolute top-0 size-16 rounded-full bg-emerald-400/50 blur-md"
          animate={{ scale: [1, 1.35, 1], opacity: [0.7, 0, 0.7] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <motion.button
        type="button"
        onClick={onClick}
        autoFocus={autoFocus}
        aria-label={label}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.9 }}
        animate={wiggle ? { rotate: [0, -12, 12, -8, 8, 0] } : undefined}
        transition={
          wiggle ? { duration: 0.6, repeat: Infinity, repeatDelay: 1.4 } : { duration: 0.15 }
        }
        className={`relative grid size-16 place-items-center rounded-full text-white shadow-xl outline-none focus-visible:ring-4 focus-visible:ring-white/50 ${className}`}
      >
        {children}
      </motion.button>
      <span className="text-sm text-white/85">{label}</span>
    </span>
  );
}
