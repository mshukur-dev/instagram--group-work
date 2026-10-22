'use client';

import { IMAGE_MAX_BYTES, type Me } from '@instagram/shared';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { UserAvatar } from '@/components/user-avatar';
import { useErrorText } from '@/features/auth/use-error-text';
import { useChangeAvatar } from '../queries';
import { profileButton } from './profile-button';

// Card at the top of Edit profile: a new photo is uploaded and saved right after it is picked
export function AvatarPicker({ me }: { me: Me }) {
  const t = useTranslations('editProfile');
  const errorText = useErrorText();
  const changeAvatar = useChangeAvatar();
  const input = useRef<HTMLInputElement>(null);
  const [tooLarge, setTooLarge] = useState(false);

  const onPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setTooLarge(file.size > IMAGE_MAX_BYTES);
    if (file.size <= IMAGE_MAX_BYTES) changeAvatar.mutate(file);
  };

  const error = tooLarge
    ? t('photoTooLarge')
    : changeAvatar.isError
      ? errorText(changeAvatar.error)
      : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 rounded-2xl bg-secondary p-4">
        <span className="relative">
          <UserAvatar src={me.avatarUrl} alt={me.username} size={56} />
          {changeAvatar.isPending && (
            <span className="absolute inset-0 grid place-items-center rounded-full bg-background/60">
              <Loader2 className="size-5 animate-spin" />
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{me.username}</p>
          <p className="truncate text-sm text-muted-foreground">{me.fullName}</p>
        </div>
        <button
          type="button"
          disabled={changeAvatar.isPending}
          onClick={() => input.current?.click()}
          className={profileButton('primary')}
        >
          {t('changePhoto')}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onPick}
          className="hidden"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
