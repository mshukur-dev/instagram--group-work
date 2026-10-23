'use client';

import { isAxiosError } from 'axios';
import { ArrowLeft, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { Dialog } from 'radix-ui';
import { useRef, useState } from 'react';
import type { UploadedMedia } from '@instagram/shared';
import { useErrorText } from '@/features/auth/use-error-text';
import { useCreatePost } from '@/features/posts/queries';
import { useUiStore } from '@/stores/ui-store';
import { ASPECTS, CROP_RESET, prepareFiles, type AspectKey, type DraftMedia } from '../draft';
import { CropStep } from './crop-step';
import { DetailsStep } from './details-step';
import { PublishStep } from './publish-step';
import { SelectStep } from './select-step';

type Step = 'select' | 'crop' | 'details' | 'publishing' | 'done' | 'error';

const titleKey = {
  select: 'title',
  crop: 'cropTitle',
  details: 'title',
  publishing: 'sharingHeader',
  done: 'sharedHeader',
  error: 'title',
} as const;

const slide = {
  enter: (direction: number) => ({ opacity: 0, x: 28 * direction }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: -28 * direction }),
};

const headerButton =
  'text-brand hover:text-brand-hover rounded-md px-1 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

// Create-post flow (POST-1, POST-2): select -> crop -> caption -> upload and share.
// Draft state is local to the flow; it is cleared when the closing animation ends.
export function CreatePostDialog() {
  const t = useTranslations('createPost');
  const errorText = useErrorText();
  const reduceMotion = useReducedMotion();
  const open = useUiStore((state) => state.createPostOpen);
  const close = useUiStore((state) => state.closeCreatePost);
  const create = useCreatePost();

  const [step, setStep] = useState<Step>('select');
  const [direction, setDirection] = useState(1);
  const [items, setItems] = useState<DraftMedia[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [aspectKey, setAspectKey] = useState<AspectKey>('1:1');
  const [caption, setCaption] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failure, setFailure] = useState('');

  const uploaded = useRef(new Map<string, UploadedMedia>());
  const dragDepth = useRef(0);
  const noticeTimer = useRef<number | undefined>(undefined);

  const active = items.find((item) => item.id === activeId) ?? items[0];
  const aspect = ASPECTS.find((a) => a.key === aspectKey)?.value ?? 1;
  const canDropFiles = step === 'select' || step === 'crop';

  const goTo = (next: Step, dir: number) => {
    setDirection(dir);
    setStep(next);
  };

  const reset = () => {
    items.forEach((item) => URL.revokeObjectURL(item.url));
    uploaded.current.clear();
    create.reset();
    setItems([]);
    setActiveId(null);
    setAspectKey('1:1');
    setCaption('');
    setNotice(null);
    setConfirmDiscard(false);
    setDragging(false);
    setProgress(0);
    setFailure('');
    setDirection(1);
    setStep('select');
    dragDepth.current = 0;
  };

  const showNotice = (text: string) => {
    window.clearTimeout(noticeTimer.current);
    setNotice(text);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 4500);
  };

  const addFiles = async (files: File[]) => {
    if (!files.length) return;
    const { accepted, rejected } = await prepareFiles(files, items.length);
    const reason = rejected[0];
    if (reason) showNotice(t(`reject.${reason}`));
    const first = accepted[0];
    if (!first) return;
    setItems((current) => [...current, ...accepted]);
    if (step === 'select') {
      setActiveId(first.id);
      goTo('crop', 1);
    }
  };

  const updateItem = (id: string, patch: Partial<DraftMedia>) => {
    // A new crop means the file has to be uploaded again
    if ('areaPixels' in patch) uploaded.current.delete(id);
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const changeAspect = (key: AspectKey) => {
    setAspectKey(key);
    // A new shape invalidates every crop
    setItems((current) => current.map((item) => ({ ...item, ...CROP_RESET })));
    uploaded.current.clear();
  };

  const removeItem = (id: string) => {
    const target = items.find((item) => item.id === id);
    if (target) URL.revokeObjectURL(target.url);
    uploaded.current.delete(id);
    const rest = items.filter((item) => item.id !== id);
    setItems(rest);
    if (activeId === id) setActiveId(rest[0]?.id ?? null);
    if (!rest.length) goTo('select', -1);
  };

  const publish = () => {
    setProgress(0);
    goTo('publishing', 1);
    create.mutate(
      { items, aspect, caption, uploaded: uploaded.current, onProgress: setProgress },
      {
        onSuccess: () => setStep('done'),
        onError: (error) => {
          // Cloudinary answers with its own error format, not our ApiError
          const fromCloudinary = isAxiosError(error) && error.config?.url?.startsWith('https://');
          setFailure(fromCloudinary ? t('uploadFailed') : errorText(error));
          setStep('error');
        },
      },
    );
  };

  // Also called for a press on the backdrop: Radix forces pointer-events on the content layer,
  // so that layer swallows the click and the wrapper div below reports it itself.
  const requestClose = () => {
    if (step === 'publishing') return;
    if (step === 'done' || !items.length) return close();
    setConfirmDiscard(true);
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (canDropFiles) void addFiles(Array.from(event.dataTransfer.files));
  };

  const dragHandlers = {
    onDragEnter: (event: React.DragEvent) => {
      if (!canDropFiles || !event.dataTransfer.types.includes('Files')) return;
      dragDepth.current += 1;
      setDragging(true);
    },
    onDragLeave: () => {
      if (!canDropFiles) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    },
    onDragOver: (event: React.DragEvent) => event.preventDefault(),
    onDrop,
  };

  const bodyKey = step === 'publishing' || step === 'done' || step === 'error' ? 'publish' : step;
  const spring = reduceMotion
    ? { duration: 0 }
    : ({ type: 'spring', stiffness: 380, damping: 34 } as const);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && requestClose()}>
      <AnimatePresence onExitComplete={reset}>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.2 }}
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
              />
            </Dialog.Overlay>

            <Dialog.Content
              asChild
              forceMount
              onInteractOutside={(event) => {
                // Dropping a file on the backdrop must not count as a click outside
                if (dragging) event.preventDefault();
              }}
            >
              <div
                onPointerDown={(event) => {
                  if (event.target === event.currentTarget) requestClose();
                }}
                className="fixed inset-0 z-50 grid place-items-center p-4 outline-none"
              >
                {step !== 'publishing' && (
                  <button
                    type="button"
                    onClick={requestClose}
                    aria-label={t('close')}
                    className="pointer-events-auto fixed top-4 right-4 grid size-10 place-items-center rounded-full text-white outline-none transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <X className="size-6" />
                  </button>
                )}

                <motion.div
                  initial={{ opacity: 0, scale: 0.94, y: 14, width: 560 }}
                  animate={{ opacity: 1, scale: 1, y: 0, width: step === 'details' ? 900 : 560 }}
                  exit={{ opacity: 0, scale: 0.97, y: 8 }}
                  transition={spring}
                  style={{ maxWidth: 'calc(100vw - 2rem)' }}
                  className="bg-card text-card-foreground pointer-events-auto relative flex h-[min(88dvh,640px)] flex-col overflow-hidden rounded-2xl shadow-2xl"
                  {...dragHandlers}
                >
                  <header className="border-border/50 grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b px-4">
                    <div className="justify-self-start">
                      {(step === 'crop' || step === 'details') && (
                        <button
                          type="button"
                          onClick={() =>
                            step === 'crop' ? setConfirmDiscard(true) : goTo('crop', -1)
                          }
                          aria-label={t('back')}
                          className="-ml-1 grid size-8 place-items-center rounded-full outline-none transition-colors hover:bg-foreground/6 focus-visible:ring-2 focus-visible:ring-ring/60"
                        >
                          <ArrowLeft className="size-5" />
                        </button>
                      )}
                    </div>
                    <Dialog.Title className="text-[15px] font-semibold">
                      {t(titleKey[step])}
                    </Dialog.Title>
                    <div className="justify-self-end">
                      {step === 'crop' && (
                        <button
                          type="button"
                          onClick={() => goTo('details', 1)}
                          className={headerButton}
                        >
                          {t('next')}
                        </button>
                      )}
                      {step === 'details' && (
                        <button type="button" onClick={publish} className={headerButton}>
                          {t('share')}
                        </button>
                      )}
                    </div>
                  </header>

                  <div className="relative min-h-0 flex-1">
                    <AnimatePresence mode="wait" initial={false} custom={direction}>
                      <motion.div
                        key={bodyKey}
                        custom={direction}
                        variants={slide}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute inset-0"
                      >
                        {step === 'select' && (
                          <SelectStep dragging={dragging} onFiles={(f) => void addFiles(f)} />
                        )}
                        {step === 'crop' && active && (
                          <CropStep
                            items={items}
                            active={active}
                            aspectKey={aspectKey}
                            onSelect={setActiveId}
                            onAspect={changeAspect}
                            onChange={updateItem}
                            onRemove={removeItem}
                            onReorder={setItems}
                            onFiles={(f) => void addFiles(f)}
                          />
                        )}
                        {step === 'details' && (
                          <DetailsStep
                            items={items}
                            aspect={aspect}
                            caption={caption}
                            onCaption={setCaption}
                          />
                        )}
                        {bodyKey === 'publish' && (
                          <PublishStep
                            status={
                              step === 'done' ? 'done' : step === 'error' ? 'error' : 'publishing'
                            }
                            progress={progress}
                            errorText={failure}
                            onRetry={publish}
                            onBack={() => goTo('details', -1)}
                            onDone={close}
                          />
                        )}
                      </motion.div>
                    </AnimatePresence>

                    <AnimatePresence>
                      {dragging && step === 'crop' && (
                        <motion.div
                          key="drop"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="bg-background/80 pointer-events-none absolute inset-0 z-10 grid place-items-center text-xl font-light backdrop-blur-sm"
                        >
                          {t('dropMore')}
                        </motion.div>
                      )}
                      {notice && (
                        <motion.p
                          key="notice"
                          role="status"
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{
                            duration: reduceMotion ? 0 : 0.25,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                          className="bg-foreground text-background absolute top-3 left-1/2 z-10 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full px-4 py-2 text-center text-sm shadow-lg"
                        >
                          {notice}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  <AnimatePresence>
                    {confirmDiscard && (
                      <motion.div
                        key="confirm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.18 }}
                        className="bg-background/70 absolute inset-0 z-20 grid place-items-center p-6 backdrop-blur-sm"
                      >
                        <motion.div
                          role="alertdialog"
                          aria-labelledby="discard-title"
                          initial={{ scale: 0.92, y: 8 }}
                          animate={{ scale: 1, y: 0 }}
                          exit={{ scale: 0.95 }}
                          transition={spring}
                          className="bg-card border-border/50 w-full max-w-[320px] overflow-hidden rounded-2xl border text-center shadow-xl"
                        >
                          <div className="px-6 pt-6 pb-5">
                            <h2 id="discard-title" className="text-lg font-semibold">
                              {t('discardTitle')}
                            </h2>
                            <p className="text-muted-foreground mt-1 text-sm">{t('discardBody')}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDiscard(false);
                              close();
                            }}
                            className="text-destructive border-border/50 hover:bg-foreground/4 w-full border-t py-3 text-sm font-bold outline-none transition-colors focus-visible:bg-foreground/6"
                          >
                            {t('discard')}
                          </button>
                          <button
                            type="button"
                            autoFocus
                            onClick={() => setConfirmDiscard(false)}
                            className="border-border/50 hover:bg-foreground/4 w-full border-t py-3 text-sm outline-none transition-colors focus-visible:bg-foreground/6"
                          >
                            {t('cancel')}
                          </button>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                <Dialog.Description className="sr-only">{t('description')}</Dialog.Description>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
