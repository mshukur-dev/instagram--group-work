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

// CALL-3: a 1:1 call ringing for me. The caller's face, blurred into the whole card, with
// rings pulsing out of their avatar like sound; Decline on the left, Accept on the right.
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
          className="fixed inset-0 z-95 grid place-items-center bg-black/45 p-4 backdrop-blur-sm max-md:p-0"
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-label={t(video ? 'incomingVideo' : 'incomingAudio')}
            initial={{ opacity: 0, scale: 0.9, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="relative flex w-full max-w-85 flex-col items-center overflow-hidden rounded-[28px] bg-neutral-900 px-6 pt-10 pb-8 text-white shadow-2xl max-md:h-dvh max-md:max-w-none max-md:justify-between max-md:rounded-none max-md:pt-24 max-md:pb-16"
          >
            {avatar && (
              <img
                src={avatar}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 size-full scale-150 object-cover opacity-50 blur-2xl"
              />
            )}
            <span aria-hidden="true" className="absolute inset-0 bg-black/40" />

            <div className="relative flex flex-col items-center">
              <span className="relative grid place-items-center">
                {!reduceMotion &&
                  [0, 1].map((i) => (
                    <motion.span
                      key={i}
                      aria-hidden="true"
                      className="absolute size-24 rounded-full border-2 border-white/40"
                      initial={{ scale: 1, opacity: 0.6 }}
                      animate={{ scale: 1.9, opacity: 0 }}
                      transition={{ duration: 2, repeat: Infinity, delay: i, ease: 'easeOut' }}
                    />
                  ))}
                <UserAvatar src={caller.avatarUrl} alt="" size={96} />
              </span>
              <p className="mt-6 text-xl font-semibold">{caller.username}</p>
              <p className="mt-1 text-sm text-white/70">
                {t(video ? 'incomingVideo' : 'incomingAudio')}
              </p>
            </div>

            <div className="relative mt-10 flex w-full justify-around">
              <RoundAction
                label={t('decline')}
                onClick={() => decline(incoming)}
                className="bg-destructive"
              >
                <PhoneOff className="size-7" />
              </RoundAction>
              <RoundAction
                label={t('accept')}
                onClick={() => void accept(incoming)}
                className="bg-emerald-500"
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
    <span className="flex flex-col items-center gap-2">
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
        className={`grid size-16 place-items-center rounded-full text-white shadow-lg outline-none focus-visible:ring-4 focus-visible:ring-white/50 ${className}`}
      >
        {children}
      </motion.button>
      <span className="text-sm text-white/85">{label}</span>
    </span>
  );
}
