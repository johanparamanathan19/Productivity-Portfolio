/**
 * Self-contained canvas confetti burst, themed from the current palette.
 */

const PARTICLE_COUNT = 110;

/** @param {HTMLCanvasElement} canvas */
export function createConfetti(canvas) {
  const ctx = canvas.getContext('2d');
  let particles = [];
  let frameId = null;

  function resize() {
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
  }
  resize();
  window.addEventListener('resize', resize);

  /** Read the live theme so confetti always matches the accent. */
  function palette() {
    const styles = getComputedStyle(document.documentElement);
    return [
      styles.getPropertyValue('--accent').trim(),
      styles.getPropertyValue('--accent-2').trim(),
      '#ffffff',
    ];
  }

  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter((p) => p.life > 0);

    particles.forEach((p) => {
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.spin;
      p.life -= p.decay;

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });

    if (particles.length) {
      frameId = requestAnimationFrame(frame);
    } else {
      cancelAnimationFrame(frameId);
      frameId = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  return {
    launch() {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const colors = palette();
      const originX = canvas.width / 2;
      const originY = canvas.height * 0.42;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (4 + Math.random() * 9) * devicePixelRatio;
        particles.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 6 * devicePixelRatio,
          gravity: 0.28 * devicePixelRatio,
          size: (4 + Math.random() * 5) * devicePixelRatio,
          rotation: Math.random() * Math.PI,
          spin: (Math.random() - 0.5) * 0.3,
          color: colors[i % colors.length],
          life: 1,
          decay: 0.006 + Math.random() * 0.006,
        });
      }

      if (!frameId) frameId = requestAnimationFrame(frame);
    },
  };
}
