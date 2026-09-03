/* =========================================================
   FX — SISTEMA DE EFECTOS VISUALES
   Partículas, destellos de pantalla y popups de puntaje.
   Se dibuja directamente sobre el mismo canvas y contexto del
   tablero (dentro de draw(), ya dentro del translate del
   screen-shake existente), así que no necesita canvas propio
   ni sincronizar tamaños. game.js solo llama a estos métodos
   en los momentos clave (línea completada, pieza encajada,
   subida de nivel, game over, recepción de basura...).
   ========================================================= */

const FX = (() => {
    const CELL = 20; // Debe coincidir con blockSize en game.js

    let particles = [];
    let popups = [];

    let flashRGB = null;
    let flashAlpha = 0;
    let flashDuration = 0;
    let flashElapsed = 0;

    let lastTime = null;
    let reduceMotion = false;

    function init() {
        reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
    init();

    function spawnBurst(cx, cy, color, count, opts = {}) {
        if (reduceMotion) return;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = (opts.minSpeed || 30) + Math.random() * (opts.maxSpeed || 70);
            particles.push({
                x: cx, y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - (opts.upBias || 0),
                life: 0,
                maxLife: (opts.life || 0.5) + Math.random() * 0.25,
                size: (opts.size || 2) + Math.random() * 1.6,
                color,
                gravity: opts.gravity ?? 200
            });
        }
    }

    // rowIndices: filas (0-19) completadas en el arena del jugador
    function spawnLineClearFx(rowIndices) {
        if (!rowIndices || !rowIndices.length) return;
        const isTetris = rowIndices.length >= 4;
        rowIndices.forEach(row => {
            const y = (row + 0.5) * CELL;
            for (let col = 0; col < 12; col++) {
                const x = (col + 0.5) * CELL;
                spawnBurst(x, y, isTetris ? '#FFE135' : '#0DC2FF', isTetris ? 5 : 3, {
                    life: 0.45, maxSpeed: 130, gravity: 260, size: 2.2
                });
            }
        });
        flash(isTetris ? '255,225,53' : '13,194,255', isTetris ? 0.30 : 0.15, 0.3);
    }

    function spawnLockFx(matrix, pos, color) {
        if (!matrix) return;
        matrix.forEach((row, y) => {
            row.forEach((val, x) => {
                if (val !== 0) {
                    const px = (pos.x + x + 0.5) * CELL;
                    const py = (pos.y + y + 0.5) * CELL;
                    spawnBurst(px, py, color, 2, { life: 0.2, maxSpeed: 22, gravity: 50, size: 1.4 });
                }
            });
        });
    }

    function spawnDropTrail(matrix, pos, fromY, toY, color) {
        if (!matrix || reduceMotion) return;
        const cols = new Set();
        matrix.forEach(row => row.forEach((v, x) => { if (v !== 0) cols.add(x); }));
        cols.forEach(x => {
            const px = (pos.x + x + 0.5) * CELL;
            for (let y = fromY; y < toY; y++) {
                if (Math.random() < 0.5) {
                    particles.push({
                        x: px, y: (y + 0.5) * CELL,
                        vx: 0, vy: 10, life: 0, maxLife: 0.16,
                        size: 1.6, color, gravity: 0
                    });
                }
            }
        });
    }

    function spawnScorePopup(text, col, row, color) {
        popups.push({
            x: (col + 0.5) * CELL, y: (row + 0.5) * CELL,
            text, color: color || '#FFE135',
            life: 0, maxLife: 1.0, vy: -30
        });
    }

    function flash(rgb, alpha, duration) {
        flashRGB = rgb;
        flashAlpha = alpha;
        flashDuration = duration;
        flashElapsed = 0;
    }

    function update(dt) {
        particles = particles.filter(p => {
            p.life += dt;
            if (p.life >= p.maxLife) return false;
            p.vy += p.gravity * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            return true;
        });

        popups = popups.filter(p => {
            p.life += dt;
            if (p.life >= p.maxLife) return false;
            p.y += p.vy * dt;
            return true;
        });

        if (flashElapsed < flashDuration) flashElapsed += dt;
    }

    // Se llama una vez por frame desde draw(), con el mismo
    // contexto/canvas del tablero (ya trasladado por el shake).
    function render(ctx) {
        const now = performance.now();
        const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0;
        lastTime = now;
        update(dt);

        if (!particles.length && !popups.length && !(flashRGB && flashElapsed < flashDuration)) return;

        if (flashRGB && flashElapsed < flashDuration) {
            const t = 1 - (flashElapsed / flashDuration);
            ctx.fillStyle = `rgba(${flashRGB}, ${(flashAlpha * t).toFixed(3)})`;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }

        particles.forEach(p => {
            const t = Math.max(0, 1 - p.life / p.maxLife);
            ctx.globalAlpha = t;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        popups.forEach(p => {
            const t = Math.max(0, 1 - p.life / p.maxLife);
            ctx.globalAlpha = t;
            ctx.fillStyle = p.color;
            ctx.font = "bold 14px 'Space Mono', monospace";
            ctx.textAlign = 'center';
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 6;
            ctx.fillText(p.text, p.x, p.y);
            ctx.shadowBlur = 0;
        });
        ctx.globalAlpha = 1;
    }

    return { render, spawnLineClearFx, spawnLockFx, spawnDropTrail, spawnScorePopup, flash };
})();