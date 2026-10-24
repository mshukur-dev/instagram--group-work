import { flushSync } from 'react-dom';

let switching = false;

/**
 * True while the reveal runs. The browser lays a picture of the page over everything meanwhile,
 * so hover-driven UI (the sidebar) sees the pointer leave and must not react to it.
 */
export const isThemeSwitching = () => switching;

/**
 * Switches the theme with a circle that grows from `origin` (e.g. the clicked button) until the
 * new theme covers the screen. `applyTheme` must change the page synchronously.
 * Without View Transitions support, or with reduced motion, the theme simply switches.
 */
export function switchThemeWithReveal(origin: HTMLElement, applyTheme: () => void) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!('startViewTransition' in document) || reduceMotion) {
    applyTheme();
    return;
  }

  // Center of the button and the distance to the farthest corner of the screen
  const rect = origin.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );

  // The browser takes a picture of the old page, we change the theme, then the new page
  // is revealed through a growing circle (the default cross-fade is turned off in globals.css)
  switching = true;
  const transition = document.startViewTransition(() => flushSync(applyTheme));
  void transition.finished.finally(() => {
    switching = false;
  });
  void transition.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      {
        duration: 1200,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        pseudoElement: '::view-transition-new(root)',
      },
    );
  });
}
