'use client';

import {
  ClientEvent,
  IMAGE_MAX_BYTES,
  MESSAGE_MAX,
  type SendMessageInput,
  VIDEO_MAX_BYTES,
} from '@instagram/shared';
import { Heart, Image as ImageIcon, Loader2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getMediaSignature } from '@/features/posts/api';
import { uploadToCloudinary } from '@/lib/cloudinary-upload';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '../api';

// "typing…" goes out at most this often while keys are pressed, and stops after this pause
const TYPING_THROTTLE_MS = 2500;
const TYPING_IDLE_MS = 3000;
// Photos and videos picked at once (Instagram allows up to 10 too)
const MAX_PICK = 10;

type Input = Omit<SendMessageInput, 'clientId'>;
/** A picked file while it uploads: its local preview */
type Pending = { key: string; preview: string; video: boolean };

type Props = {
  conversationId: string;
  replyTo: ChatMessage | null;
  myId: string | undefined;
  onCancelReply: () => void;
  onSend: (input: Input) => void;
  /** Several photos at once, sent in the picked order */
  onSendMany: (inputs: Input[]) => Promise<void>;
};

// The field at the bottom of a chat. Enter sends, Shift+Enter breaks the line; an empty field
// offers a quick heart, a typed one the "Send" button. A photo or video goes straight to
// Cloudinary and is sent as a MEDIA message; several picked together become a pile in the chat.
// Pasting an image into the field sends it the same way.
export function Composer({
  conversationId,
  replyTo,
  myId,
  onCancelReply,
  onSend,
  onSendMany,
}: Props) {
  const t = useTranslations('direct');
  const [text, setText] = useState('');
  const [pending, setPending] = useState<Pending[]>([]);
  const uploading = pending.length > 0;
  const field = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const typingSentAt = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const emitTyping = (isTyping: boolean) =>
    getSocket()?.emit(ClientEvent.TYPING, { conversationId, isTyping });

  const stopTyping = () => {
    clearTimeout(idleTimer.current);
    if (typingSentAt.current) {
      typingSentAt.current = 0;
      emitTyping(false);
    }
  };

  // Leaving the chat (or switching to another one) ends "typing…"
  useEffect(() => stopTyping, [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Answering a message puts the cursor in the field
  useEffect(() => {
    if (replyTo) field.current?.focus();
  }, [replyTo]);

  // The field grows with its text up to about five lines
  useEffect(() => {
    const el = field.current;
    if (!el) return;
    // Empty: one line. (Measuring an empty field right after it mounts, before it has its
    // width, would wrap the placeholder letter by letter and make the field tall.)
    if (!text) {
      el.style.height = '';
      return;
    }
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [text]);

  const onChange = (value: string) => {
    setText(value);
    if (!value.trim()) return stopTyping();
    const now = Date.now();
    if (now - typingSentAt.current > TYPING_THROTTLE_MS) {
      typingSentAt.current = now;
      emitTyping(true);
    }
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  };

  const submit = () => {
    const value = text.trim();
    if (!value) return;
    onSend({ type: 'TEXT', text: value });
    setText('');
    stopTyping();
  };

  const pickFiles = async (picked: File[]) => {
    if (uploading) return;
    const files = picked
      .filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'))
      .slice(0, MAX_PICK);
    const fits = files.filter(
      (f) => f.size <= (f.type.startsWith('video/') ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES),
    );
    if (fits.length < files.length) toast.error(t('fileTooLarge'));
    if (picked.length > MAX_PICK) toast.error(t('tooManyFiles', { count: MAX_PICK }));
    if (fits.length === 0) return;

    const previews = fits.map((file) => ({
      key: crypto.randomUUID(),
      preview: URL.createObjectURL(file),
      video: file.type.startsWith('video/'),
    }));
    setPending(previews);
    try {
      const signature = await getMediaSignature({ folder: 'messages' });
      const results = await Promise.allSettled(
        fits.map((file) => uploadToCloudinary(file, signature)),
      );
      const inputs: Input[] = results.flatMap((r) =>
        r.status === 'fulfilled'
          ? [{ type: 'MEDIA' as const, mediaUrl: r.value.url, mediaType: r.value.type }]
          : [],
      );
      if (inputs.length < fits.length) toast.error(t('uploadFailed'));
      setPending([]);
      const [only] = inputs;
      if (inputs.length === 1 && only) onSend(only);
      else if (inputs.length > 1) await onSendMany(inputs);
    } catch {
      toast.error(t('uploadFailed'));
      setPending([]);
    } finally {
      previews.forEach((p) => URL.revokeObjectURL(p.preview));
    }
  };

  const replyName = replyTo && (replyTo.sender.id === myId ? null : replyTo.sender.username);

  return (
    <div className="shrink-0 px-4 pt-1 pb-4 max-md:px-3 max-md:pb-3">
      <AnimatePresence initial={false}>
        {replyTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 px-3 pb-2">
              <div className="min-w-0 flex-1 text-xs">
                <p className="font-semibold">
                  {replyName ? t('replyingTo', { username: replyName }) : t('replyingToYourself')}
                </p>
                <p className="truncate text-muted-foreground">
                  {replyTo.text ?? t('preview.photo')}
                </p>
              </div>
              <button
                type="button"
                onClick={onCancelReply}
                aria-label={t('cancelReply')}
                className="grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/6"
              >
                <X className="size-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Photos being uploaded, dimmed under a spinner until they are sent */}
      <AnimatePresence initial={false}>
        {uploading && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div
              className="flex gap-2 overflow-x-auto px-2 pb-2"
              role="status"
              aria-label={t('uploading')}
            >
              {pending.map((p, i) => (
                <motion.span
                  key={p.key}
                  initial={{ opacity: 0, scale: 0.8, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 30, delay: i * 0.03 }}
                  className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-muted"
                >
                  {p.video ? (
                    <video src={p.preview} muted playsInline className="size-full object-cover" />
                  ) : (
                    <img src={p.preview} alt="" className="size-full object-cover" />
                  )}
                  <span className="absolute inset-0 grid place-items-center bg-black/35">
                    <Loader2 className="size-5 animate-spin text-white" />
                  </span>
                </motion.span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className={cn(
          'flex items-end gap-2 border border-border px-2 py-1.5 transition-[border-radius] focus-within:border-foreground/25',
          text.includes('\n') || text.length > 60 ? 'rounded-3xl' : 'rounded-full',
        )}
      >
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          aria-label={t('attachPhoto')}
          className="grid size-8 shrink-0 place-items-center rounded-full outline-none transition-colors hover:bg-foreground/6 focus-visible:ring-2 focus-visible:ring-ring"
        >
          {uploading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <ImageIcon className="size-5" />
          )}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
          multiple
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = '';
            if (files.length) void pickFiles(files);
          }}
        />

        <textarea
          ref={field}
          rows={1}
          value={text}
          maxLength={MESSAGE_MAX}
          onChange={(event) => onChange(event.target.value)}
          onBlur={stopTyping}
          onPaste={(event) => {
            const files = Array.from(event.clipboardData.files);
            if (files.length) {
              event.preventDefault();
              void pickFiles(files);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={t('placeholder')}
          aria-label={t('placeholder')}
          className="max-h-30 min-h-8 flex-1 resize-none bg-transparent py-1.5 text-[15px] leading-5 outline-none placeholder:text-muted-foreground"
        />

        <AnimatePresence mode="popLayout" initial={false}>
          {text.trim() ? (
            <motion.button
              key="send"
              type="submit"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.12 }}
              className="h-8 shrink-0 rounded-full px-3 text-sm font-semibold text-brand outline-none transition-colors hover:text-brand-hover focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t('send')}
            </motion.button>
          ) : (
            <motion.button
              key="heart"
              type="button"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.12 }}
              whileTap={{ scale: 0.8 }}
              onClick={() => onSend({ type: 'TEXT', text: '❤️' })}
              aria-label={t('sendHeart')}
              className="grid size-8 shrink-0 place-items-center rounded-full outline-none transition-colors hover:bg-foreground/6 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Heart className="size-5" />
            </motion.button>
          )}
        </AnimatePresence>
      </form>
    </div>
  );
}
