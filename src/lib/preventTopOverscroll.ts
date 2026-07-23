const INTERACTIVE_SELECTOR = '[role="dialog"], [data-vaul-drawer], [data-radix-dialog-content]';

function getScrollParent(node: EventTarget | null): Element {
  let el = node instanceof Element ? node : null;
  while (el && el !== document.body && el !== document.documentElement) {
    const { overflowY } = getComputedStyle(el);
    if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight) {
      return el;
    }
    el = el.parentElement;
  }
  return document.scrollingElement ?? document.documentElement;
}

let startY = 0;

function onTouchStart(e: TouchEvent) {
  startY = e.touches[0].clientY;
}

function onTouchMove(e: TouchEvent) {
  const target = e.target as Element | null;
  if (target?.closest(INTERACTIVE_SELECTOR)) return;

  const scrollEl = getScrollParent(target);
  const draggingDown = e.touches[0].clientY > startY;

  if (draggingDown && scrollEl.scrollTop <= 0) {
    e.preventDefault();
  }
}

export function initPreventTopOverscroll() {
  document.addEventListener("touchstart", onTouchStart, { passive: true });
  document.addEventListener("touchmove", onTouchMove, { passive: false });
}
