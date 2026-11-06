// Small touches of delight: numbers that roll up to their value, and a burst of stars.
// Everything here does nothing when the visitor has asked their device for reduced motion.
const FX = (() => {
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const shown = {};                                  // the last number shown under each key, so a refresh rolls from there, not from zero

  // Rolls `el` from what it last showed (or 0) up to `to`. render(value) must return the HTML for a value.
  function countUp(el, to, render, key, ms = 750) {
    if (!el) return;
    const from = key in shown ? shown[key] : 0;
    shown[key] = to;
    if (still() || Math.abs(to - from) < 1e-9) { el.innerHTML = render(to); return; }
    el.innerHTML = render(from);
    const t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / ms);
      el.innerHTML = render(from + (to - from) * easeOut(k));
      if (k < 1) requestAnimationFrame(step); else el.innerHTML = render(to);
    };
    requestAnimationFrame(step);
  }

  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.6 6.4 6.9.6-5.2 4.6 1.6 6.8L12 16.8 6.1 20.4l1.6-6.8L2.5 9l6.9-.6z"/></svg>';
  const COLORS = ['var(--accent)', 'var(--ok)', 'var(--sky)', 'var(--hol)', 'var(--sick)'];
  // A burst of little stars flying out from the middle of `anchor`.
  function burst(anchor, n = 16) {
    if (still() || !anchor) return;
    const r = anchor.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      s.className = 'fxstar'; s.innerHTML = STAR; s.style.color = COLORS[i % COLORS.length];
      s.style.left = cx + 'px'; s.style.top = cy + 'px';
      const size = 10 + Math.random() * 14;
      s.style.width = s.style.height = size + 'px';
      document.body.append(s);
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5, d = 70 + Math.random() * 90;
      const anim = s.animate([
        { transform: 'translate(-50%,-50%) scale(.2) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d - 30}px)) scale(1) rotate(${(Math.random() - .5) * 240}deg)`, opacity: 1, offset: .55 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * d * 1.15}px), calc(-50% + ${Math.sin(a) * d + 40}px)) scale(.4) rotate(${(Math.random() - .5) * 360}deg)`, opacity: 0 },
      ], { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.3,1)' });
      anim.onfinish = () => s.remove();
    }
  }
  return { countUp, burst };
})();
