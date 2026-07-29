import { useEffect, useRef } from 'react';

/**
 * Animated background of small key and padlock icons that drift gently and
 * react to the mouse cursor — particles near the cursor are pushed away,
 * creating an interactive field similar to the dot effect on antigravity.google.
 *
 * Rendered on a <canvas> behind the welcome page content. The canvas
 * resizes to fill its parent and cleans up its animation frame on unmount.
 */
export function KeyParticles() {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const particlesRef = useRef([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || typeof Path2D === 'undefined') return; // jsdom or no canvas

    const PARTICLE_COUNT = 120;

    // Key icon: a round bow on the left, a stem going right, with teeth.
    // Drawn within a ~20x10 bounding box, centred at origin.
    const KEY_PATH = new Path2D();
    // Bow (ring) on the left
    KEY_PATH.arc(4, 5, 3.5, 0, Math.PI * 2);
    // Stem going right from the bow
    KEY_PATH.moveTo(7.5, 5);
    KEY_PATH.lineTo(18, 5);
    // First tooth (down)
    KEY_PATH.moveTo(15, 5);
    KEY_PATH.lineTo(15, 8);
    // Second tooth (down, shorter)
    KEY_PATH.moveTo(17, 5);
    KEY_PATH.lineTo(17, 7);

    // Padlock icon: shackle arc above a rounded body.
    // Drawn within a ~12x14 bounding box, centred at origin.
    const PADLOCK_PATH = new Path2D();
    // Shackle
    PADLOCK_PATH.moveTo(3, 6);
    PADLOCK_PATH.arc(6, 6, 3, Math.PI, 0, false);
    // Body (rounded rectangle)
    PADLOCK_PATH.roundRect(2, 6, 8, 7, 1.5);

    const SHAPES = [
      { path: KEY_PATH, scale: 1, lineWidth: 1.5 },
      { path: PADLOCK_PATH, scale: 1, lineWidth: 1.5 },
    ];

    const colours = [
      '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c',
      '#3498db', '#9b59b6', '#e91e63', '#00bcd4', '#ff5722',
      '#8bc34a', '#cddc39', '#ff9800', '#673ab7', '#009688',
      '#795548', '#607d8b', '#4caf50', '#ffc107', '#03a9f4',
    ];

    function resize() {
      const parent = canvas.parentElement;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    }

    function initParticles() {
      particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => {
        const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
        return {
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          size: 10 + Math.random() * 18,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.01,
          colour: colours[Math.floor(Math.random() * colours.length)],
          opacity: 0.2 + Math.random() * 0.4,
          shape,
        };
      });
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const mouse = mouseRef.current;
      const repelRadius = 100;

      for (const p of particlesRef.current) {
        // Repel from cursor
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < repelRadius && dist > 0) {
          const force = (repelRadius - dist) / repelRadius;
          p.vx += (dx / dist) * force * 0.5;
          p.vy += (dy / dist) * force * 0.5;
        }

        // Damping
        p.vx *= 0.96;
        p.vy *= 0.96;

        // Gentle drift
        p.vx += (Math.random() - 0.5) * 0.02;
        p.vy += (Math.random() - 0.5) * 0.02;

        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotSpeed;

        // Wrap around edges
        if (p.x < -p.size) p.x = canvas.width + p.size;
        if (p.x > canvas.width + p.size) p.x = -p.size;
        if (p.y < -p.size) p.y = canvas.height + p.size;
        if (p.y > canvas.height + p.size) p.y = -p.size;

        // Draw icon
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        const s = p.size / 12;
        ctx.scale(s, s);
        ctx.strokeStyle = p.colour;
        ctx.globalAlpha = p.opacity;
        ctx.lineWidth = p.shape.lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke(p.shape.path);
        ctx.restore();
      }

      animationRef.current = requestAnimationFrame(draw);
    }

    function handleMouseMove(e) {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function handleMouseLeave() {
      mouseRef.current = { x: -9999, y: -9999 };
    }

    resize();
    initParticles();
    draw();

    window.addEventListener('resize', resize);
    canvas.parentElement.addEventListener('mousemove', handleMouseMove);
    canvas.parentElement.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resize);
      canvas.parentElement.removeEventListener('mousemove', handleMouseMove);
      canvas.parentElement.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="key-particles" aria-hidden="true" />;
}
