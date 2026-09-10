import { useEffect, useRef } from "react";

const WORLD_H = 150;
const GROUND_Y = 128;
const DINO_X = 34;
const DINO_W = 52;
const DINO_H = 50;
const LASER = "#ff3b30";
const GRAVITY = 0.7;
const JUMP_V = -11.2;
const BASE_SPEED = 6;
const HI_KEY = "om_dino_hi";
const COLOR = "#f5f5f7";
const SHADE = "#d2d2d7";
const MUTED = "#6e6e73";
const INK = "#1d1d1f";

function fillRound(ctx, x, y, w, h, r) {
  const radius = Math.max(0.4, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
  ctx.fill();
}

function drawScanner(ctx, x, footY, options) {
  const { running, onGround, frame, dead } = options;
  const bob = !running && !dead ? Math.sin(frame / 16) * 1.1 : 0;
  const hop = running && onGround ? Math.abs(Math.sin(frame / 5)) * 2.4 : 0;
  const tilt = !onGround && !dead ? -0.22 : dead ? 0.16 : 0;

  ctx.save();
  ctx.translate(x + 24, footY + bob - hop);
  ctx.rotate(tilt);

  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.ellipse(2, hop + 1.2, 16, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLOR;
  fillRound(ctx, -8, -30, 16, 30, 5);
  ctx.fillStyle = SHADE;
  fillRound(ctx, -4, -26, 5, 22, 2);

  ctx.fillStyle = COLOR;
  fillRound(ctx, 4, -24, 9, 7, 2.5);
  fillRound(ctx, 10, -22, 4, 5, 1.5);

  fillRound(ctx, -14, -52, 40, 26, 8);
  ctx.beginPath();
  ctx.moveTo(24, -50);
  ctx.lineTo(40, -40);
  ctx.lineTo(24, -28);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = SHADE;
  fillRound(ctx, -10, -48, 10, 18, 4);

  ctx.fillStyle = dead ? "#2c2c2e" : "#15202b";
  fillRound(ctx, 4, -47, 18, 14, 3);

  ctx.fillStyle = dead ? MUTED : "#8fd3ff";
  let lx = 7;
  [1.6, 3.2, 1.4, 2.4, 1.5, 3, 1.4, 2.2].forEach((width, index) => {
    if (index % 2 === 0) ctx.fillRect(lx, -44, width, 8);
    lx += width + 0.7;
  });

  ctx.fillStyle = dead ? LASER : running ? "#34c759" : "#ffd60a";
  ctx.beginPath();
  ctx.arc(-6, -44, 2.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath();
  ctx.arc(-6.6, -44.6, 0.8, 0, Math.PI * 2);
  ctx.fill();

  if (running && !dead) {
    const pulse = 0.28 + 0.42 * Math.abs(Math.sin(frame / 3.5));
    ctx.strokeStyle = `rgba(255, 59, 48, ${pulse})`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(40, -39);
    ctx.lineTo(118, -39);
    ctx.stroke();
    ctx.fillStyle = `rgba(255, 59, 48, ${pulse})`;
    ctx.beginPath();
    ctx.arc(40, -39, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  if (dead) {
    ctx.strokeStyle = LASER;
    ctx.lineWidth = 1.7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(7, -45);
    ctx.lineTo(20, -35);
    ctx.moveTo(20, -45);
    ctx.lineTo(7, -35);
    ctx.stroke();
  }

  ctx.restore();
}

function sheetSize(tall) {
  return tall ? { w: 22, h: 50 } : { w: 24, h: 34 };
}

function cactusSize(tall, pair) {
  const size = sheetSize(tall);
  return { w: pair ? size.w * 2 + 6 : size.w, h: size.h };
}

function drawOrderSheet(ctx, x, groundY, tall) {
  const { w, h } = sheetSize(tall);
  const y = groundY - h;
  const fold = 7;

  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.moveTo(x + 2, y + 4);
  ctx.lineTo(x + w + 1, y + fold + 2);
  ctx.lineTo(x + w + 1, y + h + 1);
  ctx.lineTo(x + 2, y + h + 1);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = COLOR;
  ctx.beginPath();
  ctx.moveTo(x, y + 2);
  ctx.lineTo(x + w - fold, y);
  ctx.lineTo(x + w, y + fold);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = SHADE;
  ctx.beginPath();
  ctx.moveTo(x + w - fold, y);
  ctx.lineTo(x + w, y + fold);
  ctx.lineTo(x + w - fold, y + fold);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = MUTED;
  fillRound(ctx, x + 3, y + 10, w - fold - 4, 3.2, 1);

  const lines = tall ? 5 : 3;
  for (let i = 0; i < lines; i += 1) {
    const lineW = w - 9 - (i % 3) * 2.5;
    ctx.fillRect(x + 3, y + 16 + i * 4.4, Math.max(8, lineW), 1.5);
  }

  ctx.fillStyle = INK;
  let bx = x + 3;
  [1.1, 2.1, 1, 2.6, 1.1, 1.7, 2.2, 1, 2].forEach((width, index) => {
    if (index % 2 === 0) ctx.fillRect(bx, y + h - 10, width, 7);
    bx += width + 0.45;
  });
}

function hit(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function loadHi() {
  try {
    const value = Number(window.localStorage.getItem(HI_KEY));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function saveHi(value) {
  try {
    window.localStorage.setItem(HI_KEY, String(value));
  } catch {
    // ignore
  }
}

export default function DinoGame() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    let disposed = false;
    let raf = 0;
    let worldW = 600;
    let scale = 1;
    let state = "idle";
    let speed = BASE_SPEED;
    let dinoY = 0;
    let velocity = 0;
    let onGround = true;
    let frame = 0;
    let spawnIn = 80;
    let distance = 0;
    let score = 0;
    let hi = loadHi();
    let obstacles = [];
    let clouds = [
      { x: 180, y: 28, w: 36 },
      { x: 360, y: 18, w: 28 },
      { x: 520, y: 34, w: 32 },
    ];
    let groundBits = [];

    function resetGround() {
      groundBits = Array.from({ length: 28 }, () => ({
        x: Math.random() * worldW,
        w: 2 + Math.random() * 4,
        y: GROUND_Y + 4 + Math.random() * 8,
      }));
    }

    function resize() {
      const cssW = canvas.parentElement?.clientWidth || 600;
      const cssH = 180;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(cssW * dpr));
      canvas.height = Math.max(1, Math.floor(cssH * dpr));
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      worldW = (cssW * WORLD_H) / cssH;
      scale = canvas.height / WORLD_H;
      if (groundBits.length === 0) resetGround();
    }

    function jump() {
      if (state === "dead") {
        startRun(true);
        return;
      }
      if (state === "idle") {
        startRun(false);
      }
      if (onGround && state === "running") {
        velocity = JUMP_V;
        onGround = false;
      }
    }

    function startRun(fromDeath) {
      state = "running";
      speed = BASE_SPEED;
      dinoY = 0;
      velocity = fromDeath ? 0 : JUMP_V;
      onGround = fromDeath;
      frame = 0;
      spawnIn = 90;
      distance = 0;
      score = 0;
      obstacles = [];
    }

    function die() {
      state = "dead";
      if (score > hi) {
        hi = score;
        saveHi(hi);
      }
    }

    function spawn() {
      const roll = Math.random();
      const tall = roll > 0.55;
      const pair = roll > 0.82;
      const size = cactusSize(tall, pair);
      obstacles.push({
        x: worldW + 10,
        w: size.w,
        h: size.h,
        tall,
        pair,
      });
      spawnIn = Math.max(48, 90 - speed * 3 + Math.random() * 50);
    }

    function update() {
      frame += 1;
      if (state !== "running") return;

      speed = Math.min(13, BASE_SPEED + score / 180);
      distance += speed;
      score = Math.floor(distance / 8);

      if (!onGround) {
        velocity += GRAVITY;
        dinoY += velocity;
        if (dinoY >= 0) {
          dinoY = 0;
          velocity = 0;
          onGround = true;
        }
      }

      spawnIn -= 1;
      if (spawnIn <= 0) spawn();

      obstacles.forEach((item) => {
        item.x -= speed;
      });
      obstacles = obstacles.filter((item) => item.x + item.w > -20);

      clouds.forEach((cloud) => {
        cloud.x -= speed * 0.25;
        if (cloud.x < -50) {
          cloud.x = worldW + 40 + Math.random() * 80;
          cloud.y = 14 + Math.random() * 28;
        }
      });

      groundBits.forEach((bit) => {
        bit.x -= speed;
        if (bit.x < -8) bit.x = worldW + Math.random() * 40;
      });

      const dinoBox = {
        x: DINO_X + 8,
        y: GROUND_Y - DINO_H + dinoY + 8,
        w: DINO_W - 16,
        h: DINO_H - 12,
      };
      for (const item of obstacles) {
        const box = {
          x: item.x + 4,
          y: GROUND_Y - item.h + 4,
          w: item.w - 8,
          h: item.h - 6,
        };
        if (hit(dinoBox, box)) {
          die();
          break;
        }
      }
    }

    function drawCloud(x, y, w) {
      ctx.fillStyle = MUTED;
      ctx.beginPath();
      ctx.ellipse(x + w * 0.35, y, w * 0.35, 7, 0, 0, Math.PI * 2);
      ctx.ellipse(x + w * 0.62, y - 3, w * 0.28, 8, 0, 0, Math.PI * 2);
      ctx.ellipse(x + w * 0.82, y + 1, w * 0.22, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    function draw() {
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, worldW, WORLD_H);

      clouds.forEach((cloud) => drawCloud(cloud.x, cloud.y, cloud.w));

      ctx.fillStyle = COLOR;
      ctx.fillRect(0, GROUND_Y, worldW, 2);
      groundBits.forEach((bit) => {
        ctx.fillRect(bit.x, bit.y, bit.w, 2);
      });

      obstacles.forEach((item) => {
        drawOrderSheet(ctx, item.x, GROUND_Y, item.tall);
        if (item.pair) {
          drawOrderSheet(
            ctx,
            item.x + sheetSize(item.tall).w + 6,
            GROUND_Y,
            item.tall,
          );
        }
      });

      drawScanner(ctx, DINO_X, GROUND_Y + dinoY, {
        running: state === "running",
        onGround,
        frame,
        dead: state === "dead",
      });

      ctx.fillStyle = COLOR;
      ctx.font = "bold 12px Inter, system-ui, sans-serif";
      ctx.textAlign = "right";
      const scoreText = String(score).padStart(5, "0");
      const hiText = `HI ${String(hi).padStart(5, "0")}`;
      ctx.fillText(`${hiText}  ${scoreText}`, worldW - 8, 18);

      if (state === "idle") {
        ctx.textAlign = "center";
        ctx.fillStyle = COLOR;
        ctx.font = "13px Inter, system-ui, sans-serif";
        ctx.fillText("Bấm để chơi", worldW / 2, 58);
      }

      if (state === "dead") {
        ctx.textAlign = "center";
        ctx.fillStyle = COLOR;
        ctx.font = "bold 14px Inter, system-ui, sans-serif";
        ctx.fillText("G A M E  O V E R", worldW / 2, 52);
        ctx.strokeStyle = COLOR;
        ctx.strokeRect(worldW / 2 - 13, 62, 26, 26);
        ctx.beginPath();
        ctx.moveTo(worldW / 2 - 4, 68);
        ctx.lineTo(worldW / 2 - 4, 82);
        ctx.lineTo(worldW / 2 + 8, 75);
        ctx.closePath();
        ctx.fill();
      }
    }

    function loop() {
      if (disposed) return;
      update();
      draw();
      raf = window.requestAnimationFrame(loop);
    }

    function onPointer(event) {
      event.preventDefault();
      canvas.focus();
      jump();
    }

    function onKey(event) {
      if (event.code !== "Space" && event.code !== "ArrowUp") return;
      if (document.activeElement !== canvas) return;
      event.preventDefault();
      jump();
    }

    resize();
    resetGround();
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    raf = window.requestAnimationFrame(loop);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="mt-8 hidden w-full tablet:block">
      <canvas
        ref={canvasRef}
        className="block w-full cursor-pointer touch-manipulation outline-none"
        tabIndex={0}
        role="application"
        aria-label="Trò chơi máy quét mã vạch. Bấm hoặc nhấn Space để nhảy."
      />
      <p className="mt-3 text-center text-[12px] font-normal leading-[1.3] tracking-[-0.12px] text-body-muted">
        Bấm vào game, rồi Space hoặc bấm để nhảy.
      </p>
    </div>
  );
}
