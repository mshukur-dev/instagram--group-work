'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { profileButton } from '@/features/profile/components/profile-button';
import { useOpenDirect } from '../queries';

// "Message" on someone's profile: opens (or creates) the 1:1 chat with them
export function MessageButton({ userId }: { userId: string }) {
  const t = useTranslations('direct');
  const router = useRouter();
  const open = useOpenDirect();
  return (
    <button
      type="button"
      disabled={open.isPending}
      onClick={() =>
        open.mutate(userId, {
          onSuccess: (conversation) => router.push(`/direct/t/${conversation.id}`),
          onError: () => toast.error(t('dialog.createFailed')),
        })
      }
      className={profileButton('secondary')}
    >
      {open.isPending ? <Loader2 className="size-4 animate-spin" /> : t('message')}
    </button>
  );
}
