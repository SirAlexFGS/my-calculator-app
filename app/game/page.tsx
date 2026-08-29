"use client";

import { useEffect, useRef, useState } from "react";

const GRAVITY = 0.6;
const JUMP_POWER = -12;
const STOMP_BOUNCE = -8;
const MOVE_SPEED = 4;
const GAME_WIDTH = 900;
const GAME_HEIGHT = 500;

type Platform = { x: number; y: number; w: number; h: number };
type Coin = { x: number; y: number; r: number; collected: boolean };
type Enemy = {
  x: number;
  y: number;
  w: number;
  h: number;
  dir: number;
  range: [number, number];
  alive: boolean;
};

const platforms: Platform[] = [
  { x: 0, y: 460, w: 300, h: 40 },
  { x: 380, y: 460, w: 200, h: 40 },
  { x: 620, y: 380, w: 150, h: 20 },
  { x: 820, y: 460, w: 400, h: 40 },
  { x: 1300, y: 400, w: 150, h: 20 },
  { x: 1550, y: 460, w: 300, h: 40 },
  { x: 1950, y: 350, w: 200, h: 20 },
  { x: 2250, y: 460, w: 400, h: 40 },
];

const initialCoins: Coin[] = [
  { x: 450, y: 420, r: 10, collected: false },
  { x: 650, y: 340, r: 10, collected: false },
  { x: 900, y: 420, r: 10, collected: false },
  { x: 1350, y: 360, r: 10, collected: false },
  { x: 1650, y: 420, r: 10, collected: false },
  { x: 2000, y: 310, r: 10, collected: false },
];

const initialEnemies: Enemy[] = [
  { x: 850, y: 420, w: 30, h: 30, dir: 1, range: [820, 1180], alive: true },
  { x: 1600, y: 420, w: 30, h: 30, dir: 1, range: [1550, 1800], alive: true },
];

const GOAL_X = 2550;
const GOAL_Y = 380;

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const [status, setStatus] = useState<"playing" | "cleared" | "gameover">("playing");
  const [coinCount, setCoinCount] = useState(0);
  const [defeatedCount, setDefeatedCount] = useState(0);
  const [resetKey, setResetKey] = useState(0);

  const handleRestart = () => {
    setStatus("playing");
    setCoinCount(0);
    setDefeatedCount(0);
    setResetKey((k) => k + 1);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const player = {
      x: 50,
      y: 400,
      w: 30,
      h: 30,
      vx: 0,
      vy: 0,
      onGround: false,
    };

    const coins: Coin[] = initialCoins.map((c) => ({ ...c }));
    const enemies: Enemy[] = initialEnemies.map((e) => ({ ...e }));

    let cameraX = 0;
    let collected = 0;
    let defeated = 0;
    let currentStatus: "playing" | "cleared" | "gameover" = "playing";
    let animationId: number;

    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key] = false;
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    const checkAABB = (
      ax: number,
      ay: number,
      aw: number,
      ah: number,
      bx: number,
      by: number,
      bw: number,
      bh: number
    ) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

    function update() {
      if (currentStatus !== "playing") return;

      const keys = keysRef.current;

      if (keys["ArrowLeft"] || keys["a"]) {
        player.vx = -MOVE_SPEED;
      } else if (keys["ArrowRight"] || keys["d"]) {
        player.vx = MOVE_SPEED;
      } else {
        player.vx = 0;
      }

      if ((keys[" "] || keys["ArrowUp"] || keys["w"]) && player.onGround) {
        player.vy = JUMP_POWER;
        player.onGround = false;
      }

      const prevBottom = player.y + player.h;

      player.vy += GRAVITY;
      player.x += player.vx;
      player.y += player.vy;

      if (player.y > GAME_HEIGHT + 100) {
        currentStatus = "gameover";
        setStatus("gameover");
      }

      player.onGround = false;
      for (const p of platforms) {
        if (
          checkAABB(player.x, player.y, player.w, player.h, p.x, p.y, p.w, p.h)
        ) {
          if (player.vy > 0 && prevBottom - player.vy <= p.y + 5) {
            player.y = p.y - player.h;
            player.vy = 0;
            player.onGround = true;
          }
        }
      }

      if (player.x < 0) player.x = 0;

      for (const c of coins) {
        if (!c.collected) {
          const dx = player.x + player.w / 2 - c.x;
          const dy = player.y + player.h / 2 - c.y;
          if (Math.sqrt(dx * dx + dy * dy) < c.r + 18) {
            c.collected = true;
            collected += 1;
            setCoinCount(collected);
          }
        }
      }

      for (const en of enemies) {
        if (!en.alive) continue;

        en.x += en.dir * 1.5;
        if (en.x < en.range[0] || en.x > en.range[1]) {
          en.dir *= -1;
        }

        if (
          checkAABB(player.x, player.y, player.w, player.h, en.x, en.y, en.w, en.h)
        ) {
          const wasAbove = prevBottom <= en.y + 10;
          if (player.vy > 0 && wasAbove) {
            en.alive = false;
            defeated += 1;
            setDefeatedCount(defeated);
            player.vy = STOMP_BOUNCE;
          } else {
            currentStatus = "gameover";
            setStatus("gameover");
          }
        }
      }

      if (
        checkAABB(player.x, player.y, player.w, player.h, GOAL_X, GOAL_Y, 30, 80)
      ) {
        currentStatus = "cleared";
        setStatus("cleared");
      }

      cameraX = player.x - 200;
      if (cameraX < 0) cameraX = 0;
    }

    function draw() {
      if (!ctx) return;
      const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
      gradient.addColorStop(0, "#87ceeb");
      gradient.addColorStop(1, "#e0f7fa");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      ctx.save();
      ctx.translate(-cameraX, 0);

      ctx.fillStyle = "#8d6e63";
      for (const p of platforms) {
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = "#4caf50";
        ctx.fillRect(p.x, p.y, p.w, 8);
        ctx.fillStyle = "#8d6e63";
      }

      for (const c of coins) {
        if (!c.collected) {
          ctx.beginPath();
          ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
          ctx.fillStyle = "#ffd54f";
          ctx.fill();
          ctx.strokeStyle = "#f9a825";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      for (const en of enemies) {
        if (!en.alive) continue;
        ctx.fillStyle = "#e53935";
        ctx.fillRect(en.x, en.y, en.w, en.h);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(en.x + 5, en.y + 8, 6, 6);
        ctx.fillRect(en.x + 19, en.y + 8, 6, 6);
      }

      ctx.fillStyle = "#616161";
      ctx.fillRect(GOAL_X + 12, GOAL_Y, 4, 80);
      ctx.fillStyle = "#ef5350";
      ctx.beginPath();
      ctx.moveTo(GOAL_X + 16, GOAL_Y);
      ctx.lineTo(GOAL_X + 46, GOAL_Y + 10);
      ctx.lineTo(GOAL_X + 16, GOAL_Y + 20);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#3f51b5";
      ctx.fillRect(player.x, player.y, player.w, player.h);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(player.x + 6, player.y + 8, 6, 6);
      ctx.fillRect(player.x + 18, player.y + 8, 6, 6);

      ctx.restore();
    }

    function loop() {
      update();
      draw();
      animationId = requestAnimationFrame(loop);
    }
    loop();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      cancelAnimationFrame(animationId);
    };
  }, [resetKey]);

  useEffect(() => {
    function handleRestartKey(e: KeyboardEvent) {
      if (
        (status === "cleared" || status === "gameover") &&
        (e.key === "Enter" || e.key === " ")
      ) {
        e.preventDefault();
        handleRestart();
      }
    }
    window.addEventListener("keydown", handleRestartKey);
    return () => window.removeEventListener("keydown", handleRestartKey);
  }, [status]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-800 p-6">
      <h1 className="text-2xl font-bold text-white">ミニ・プラットフォーマー</h1>
      <p className="text-sm text-slate-300">
        矢印キー(または A / D)で移動、スペースキー(または W)でジャンプ。敵は上から踏むと倒せます。コインを集めて旗まで到達しよう。
      </p>

      <div className="relative overflow-hidden rounded-xl border-4 border-slate-600 shadow-2xl">
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          className="block bg-white"
        />

        <div className="absolute left-3 top-3 flex items-center gap-3 rounded-full bg-black/50 px-3 py-1 text-sm font-medium text-white">
          <span>🪙 {coinCount} / {initialCoins.length}</span>
          <span>👾 {defeatedCount} / {initialEnemies.length}</span>
        </div>

        {status === "cleared" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70">
            <p className="text-3xl font-bold text-yellow-300">🎉 CLEAR!</p>
            <p className="text-white">
              コイン獲得数: {coinCount} / {initialCoins.length}
            </p>
            <p className="text-white">
              倒した敵: {defeatedCount} / {initialEnemies.length}
            </p>
            <button
              onClick={handleRestart}
              className="rounded-full bg-white px-6 py-2 font-medium text-slate-900 hover:bg-slate-200"
            >
              もう一度プレイ
            </button>
            <p className="text-xs text-slate-300">
              (Enter または スペースキーでもリスタートできます)
            </p>
          </div>
        )}

        {status === "gameover" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70">
            <p className="text-3xl font-bold text-red-400">GAME OVER</p>
            <button
              onClick={handleRestart}
              className="rounded-full bg-white px-6 py-2 font-medium text-slate-900 hover:bg-slate-200"
            >
              もう一度プレイ
            </button>
            <p className="text-xs text-slate-300">
              (Enter または スペースキーでもリスタートできます)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}