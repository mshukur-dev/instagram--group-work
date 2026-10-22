// Round action buttons under a post (like, comment, share, save). No hover effect, only a small
// squeeze while pressed. The negative margin cancels the padding: the icon keeps its place and
// the click target is bigger.
export const iconButtonBase =
  '-m-1.5 grid place-items-center rounded-full p-1.5 outline-none transition-transform duration-150 ' +
  'active:scale-90 focus-visible:ring-2 focus-visible:ring-ring/60 motion-reduce:transition-none';
