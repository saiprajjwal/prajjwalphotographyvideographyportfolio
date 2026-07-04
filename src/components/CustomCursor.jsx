import { useEffect, useRef, useState } from 'react';
import './CustomCursor.css';

// Custom cursor with a snappy dot, a trailing ring, and a soft radial light.
// Only renders on devices with a fine pointer (mouse/trackpad).  On touch
// devices it unmounts immediately and leaves the native cursor alone.
export default function CustomCursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const lightRef = useRef(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    // Bail immediately on touch devices
    if (window.matchMedia('(pointer: coarse)').matches) {
      setIsTouch(true);
      return;
    }

    document.body.classList.add('custom-cursor-active');

    // Current mouse position (updated every frame)
    const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    // Smoothed positions for the trailing ring & light
    const ring = { x: mouse.x, y: mouse.y };
    const light = { x: mouse.x, y: mouse.y };

    const onMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    // Detect hovering over interactive elements
    const onMouseOver = (e) => {
      const tag = e.target.closest('a, button, [role="button"], .magnetic-wrapper, input, textarea, select, label');
      if (tag) setIsHovering(true);
    };
    const onMouseOut = (e) => {
      const tag = e.target.closest('a, button, [role="button"], .magnetic-wrapper, input, textarea, select, label');
      if (tag) setIsHovering(false);
    };

    // Hide cursor when it leaves the window
    const onMouseLeave = () => {
      if (dotRef.current) dotRef.current.style.opacity = '0';
      if (ringRef.current) ringRef.current.style.opacity = '0';
      if (lightRef.current) lightRef.current.style.opacity = '0';
    };
    const onMouseEnter = () => {
      if (dotRef.current) dotRef.current.style.opacity = '1';
      if (ringRef.current) ringRef.current.style.opacity = '1';
      if (lightRef.current) lightRef.current.style.opacity = '1';
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('mouseover', onMouseOver, { passive: true });
    document.addEventListener('mouseout', onMouseOut, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave);
    document.addEventListener('mouseenter', onMouseEnter);

    // Animation loop — dot follows instantly, ring and light trail with lerp
    let raf;
    const loop = () => {
      // Dot: instant position
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${mouse.x - 4}px, ${mouse.y - 4}px)`;
      }

      // Ring: smooth trailing (spring-like lerp)
      ring.x += (mouse.x - ring.x) * 0.15;
      ring.y += (mouse.y - ring.y) * 0.15;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${ring.x - 20}px, ${ring.y - 20}px)`;
      }

      // Light: even more trailing for a fluid glow
      light.x += (mouse.x - light.x) * 0.08;
      light.y += (mouse.y - light.y) * 0.08;
      if (lightRef.current) {
        lightRef.current.style.transform = `translate(${light.x - 125}px, ${light.y - 125}px)`;
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      document.body.classList.remove('custom-cursor-active');
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseover', onMouseOver);
      document.removeEventListener('mouseout', onMouseOut);
      document.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('mouseenter', onMouseEnter);
    };
  }, []);

  if (isTouch) return null;

  return (
    <>
      <div ref={dotRef} className={`cursor-dot ${isHovering ? 'is-hovering' : ''}`} />
      <div ref={ringRef} className={`cursor-ring ${isHovering ? 'is-hovering' : ''}`} />
      <div ref={lightRef} className="cursor-light" />
    </>
  );
}
