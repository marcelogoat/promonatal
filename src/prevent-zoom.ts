// Prevent all forms of pinch, double-tap, and shortcut zooming (in & out)
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  // 1. Prevent gesture zoom (Safari iOS)
  document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });

  // 2. Prevent multi-touch pinch to zoom
  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  // 3. Prevent double-tap to zoom on mobile
  let lastTouchEnd = 0;
  document.addEventListener(
    'touchend',
    (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        const target = e.target as HTMLElement | null;
        const isInput = target && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName);
        if (!isInput) {
          e.preventDefault();
        }
      }
      lastTouchEnd = now;
    },
    { passive: false }
  );

  // 4. Prevent Ctrl + Wheel zoom on desktop
  document.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  // 5. Prevent keyboard zoom shortcuts (Ctrl + / Ctrl - / Ctrl 0)
  document.addEventListener('keydown', (e) => {
    if (
      (e.ctrlKey || e.metaKey) &&
      (e.key === '+' ||
        e.key === '-' ||
        e.key === '=' ||
        e.key === '_' ||
        e.key === '0' ||
        e.keyCode === 187 ||
        e.keyCode === 189 ||
        e.keyCode === 96 ||
        e.keyCode === 48)
    ) {
      e.preventDefault();
    }
  });
}

