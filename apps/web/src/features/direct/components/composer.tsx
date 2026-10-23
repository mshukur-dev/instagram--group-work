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

type Props = {
  conversationId: string;
  replyTo: ChatMessage | null;
  myId: string | undefined;
  onCancelReply: () => void;
  onSend: (input: Omit<SendMessageInput, 'clientId'>) => void;
};

// The field at the bottom of a chat. Enter sends, Shift+Enter breaks the line; an empty field
// offers a quick heart, a typed one the "Send" button. A photo or video goes straight to
// Cloudinary and is sent as a MEDIA message.
export function Composer({ conversationId, replyTo, myId, onCancelReply, onSend }: Props) {
  const t = useTranslations('direct');
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
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

  const pickFile = async (file: File) => {
    const isVideo = file.type.startsWith('video/');
    if (file.size > (isVideo ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES)) {
      toast.error(t('fileTooLarge'));
      return;
    }
    setUploading(true);
    try {
      const signature = await getMediaSignature({ folder: 'messages' });
      const uploaded = await uploadToCloudinary(file, signature);
      onSend({ type: 'MEDIA', mediaUrl: uploaded.url, mediaType: uploaded.type });
    } catch {
      toast.error(t('uploadFailed'));
    } finally {
      setUploading(false);
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
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void pickFile(file);
          }}
        />

        <textarea
          ref={field}
          rows={1}
          value={text}
          maxLength={MESSAGE_MAX}
          onChange={(event) => onChange(event.target.value)}
          onBlur={stopTyping}
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
