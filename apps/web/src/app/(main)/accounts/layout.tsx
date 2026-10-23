import { SettingsNav } from '@/features/settings/components/settings-nav';

// Every /accounts/* page: the sections menu on the left (desktop), the section on the right
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <SettingsNav variant="column" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
