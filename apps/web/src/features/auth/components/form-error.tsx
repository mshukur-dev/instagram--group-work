export function FormError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-destructive mt-4 text-center text-sm leading-snug">
      {children}
    </p>
  );
}
