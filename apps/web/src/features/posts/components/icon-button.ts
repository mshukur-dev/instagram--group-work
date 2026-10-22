// Round action buttons under a post (like, comment, share, save). The negative margin cancels the
// padding, so the icon keeps its place and a soft circle appears behind it on hover.
export const iconButtonBase =
  '-m-1.5 grid place-items-center rounded-full p-1.5 outline-none transition-[background-color,transform] duration-150 ' +
  'active:scale-90 focus-visible:ring-2 focus-visible:ring-ring/60 motion-reduce:transition-none';

export const iconButtonHover = 'hover:bg-foreground/[0.07]';
