import { InstagramWordmark } from '@/components/icons/instagram-wordmark';

// Centered column used by every auth page. The story-ring glow behind it is the one
// decorative element; everything else stays plain like the original.
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-3 overflow-hidden px-4 py-10">
      <div
        aria-hidden="true"
        className="bg-aurora pointer-events-none absolute inset-0 -z-10 motion-safe:animate-[aurora-in_1.4s_ease-out_both]"
      />
      {children}
    </main>
  );
}

export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card shadow-float border-border/30 w-full max-w-87.5 rounded-2xl border px-10 pt-10 pb-8">
      <InstagramWordmark className="text-foreground mx-auto mb-8 h-12.75" />
      {children}
    </div>
  );
}

export function AuthSwitchCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card shadow-float border-border/30 w-full max-w-87.5 rounded-2xl border px-10 py-5 text-center text-sm">
      {children}
    </div>
  );
}
