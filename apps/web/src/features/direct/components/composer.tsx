'use client';

import {
  ClientEvent,
  IMAGE_MAX_BYTES,
  MESSAGE_MAX,
  type SendMessageInput,
  VIDEO_MAX_BYTES,
} from '@instagram/shared';
import { ArrowUp, Heart, Image as ImageIcon, Loader2, Mic, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getMediaSignature } from '@/features/posts/api';
import { uploadToCloudinary } from '@/lib/cloudinary-upload';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '../api';
import { formatVoiceTime, useVoiceRecorder } from '../voice/use-voice-recorder';

// "typing…" goes out at most this often while keys are pressed, and stops after this pause
const TYPING_THROTTLE_MS = 2500;
const TYPING_IDLE_MS = 3000;
// Photos and videos picked at once (Instagram allows up to 10 too)
const MAX_PICK = 10;
// Shorter than this is a slip of the finger, not a message
const VOICE_MIN_SECONDS = 1;

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
// Pasting an image into the field sends it the same way. The mic records a voice message:
// a red dot, the time and a live strip of the voice; the bin drops it, the arrow sends it.
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
  const [voiceSending, setVoiceSending] = useState(false);
  const finishing = useRef(false);
  const recorder = useVoiceRecorder({ onLimit: () => void sendVoice() });
  const recording = recorder.state !== 'idle' || voiceSending;

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

  const startVoice = async () => {
    stopTyping();
    try {
      await recorder.start();
    } catch (error) {
      const denied = error instanceof DOMException && error.name === 'NotAllowedError';
      toast.error(t(denied ? 'voice.denied' : 'voice.unavailable'));
    }
  };

  const sendVoice = async () => {
    if (finishing.current) return;
    finishing.current = true;
    try {
      const result = await recorder.stop();
      if (!result || result.duration < VOICE_MIN_SECONDS) {
        toast(t('voice.tooShort'));
        return;
      }
      setVoiceSending(true);
      const extension = result.blob.type.includes('mp4') ? 'm4a' : 'webm';
      const file = new File([result.blob], `voice.${extension}`, { type: result.blob.type });
      const signature = await getMediaSignature({ folder: 'messages' });
      const uploaded = await uploadToCloudinary(file, signature);
      onSend({
        type: 'VOICE',
        mediaUrl: uploaded.url,
        voice: { duration: Math.round(result.duration * 10) / 10, waveform: result.waveform },
      });
    } catch {
      toast.error(t('uploadFailed'));
    } finally {
      setVoiceSending(false);
      finishing.current = false;
    }
  };

  // While recording, Enter sends the voice message and Escape drops it
  const sendVoiceRef = useRef(sendVoice);
  sendVoiceRef.current = sendVoice;
  const { state: recorderState, cancel: cancelVoice } = recorder;
  useEffect(() => {
    if (recorderState !== 'recording') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !event.repeat) {
        event.preventDefault();
        void sendVoiceRef.current();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        cancelVoice();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [recorderState, cancelVoice]);

  const replyName = replyTo && (replyTo.sender.id === myId ? null : replyTo.sender.username);

  return (
    // Phone: clear of the iPhone's home indicator (the inset is 0 elsewhere); with the keyboard up
    // (focus inside) the indicator is hidden, so the field sits close to the keys
    <div className="shrink-0 px-4 pt-1 pb-4 max-md:px-3 max-md:pb-[calc(max(env(safe-area-inset-bottom),0.5rem)+0.5rem)] max-md:focus-within:pb-2">
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
                  {replyTo.text ?? t(replyTo.type === 'VOICE' ? 'preview.voice' : 'preview.photo')}
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

      {recording ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          role="status"
          aria-label={t('voice.recording')}
          className="flex h-11.5 items-center gap-3 rounded-full border border-border px-2"
        >
          <button
            type="button"
            onClick={recorder.cancel}
            disabled={voiceSending}
            aria-label={t('voice.discard')}
            className="grid size-8 shrink-0 place-items-center rounded-full text-destructive outline-none transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
          >
            <Trash2 className="size-4.5" />
          </button>
          <span className="flex shrink-0 items-center gap-2 text-sm tabular-nums">
            <span className="size-2 animate-pulse rounded-full bg-destructive" />
            {formatVoiceTime(recorder.elapsed)}
          </span>
          {/* The voice as it comes in, newest on the right */}
          <span
            aria-hidden="true"
            className="flex h-6 min-w-0 flex-1 items-center justify-end gap-0.5 overflow-hidden"
          >
            {recorder.levels.map((level, i) => (
              <span
                key={i}
                className="w-0.75 shrink-0 rounded-full bg-foreground/70 transition-[height] duration-75"
                style={{ height: `${Math.max(12, level * 100)}%` }}
              />
            ))}
          </span>
          <button
            type="button"
            onClick={() => void sendVoice()}
            disabled={recorder.state !== 'recording' || voiceSending}
            aria-label={t('voice.send')}
            className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-brand-foreground outline-none transition-colors hover:bg-brand-hover focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            {voiceSending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4.5" strokeWidth={2.5} />
            )}
          </button>
        </motion.div>
      ) : (
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
              <motion.span
                key="idle"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.12 }}
                className="flex shrink-0 items-center"
              >
                <button
                  type="button"
                  onClick={() => void startVoice()}
                  aria-label={t('voice.record')}
                  className="grid size-8 shrink-0 place-items-center rounded-full outline-none transition-colors hover:bg-foreground/6 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Mic className="size-5" />
                </button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.8 }}
                  onClick={() => onSend({ type: 'TEXT', text: '❤️' })}
                  aria-label={t('sendHeart')}
                  className="grid size-8 shrink-0 place-items-center rounded-full outline-none transition-colors hover:bg-foreground/6 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Heart className="size-5" />
                </motion.button>
              </motion.span>
            )}
          </AnimatePresence>
        </form>
      )}
    </div>
  );
}
