"use client";

import { useEffect, useRef, useState } from "react";

const GRAVITY = 0.6;
const JUMP_POWER = -12;
const STOMP_BOUNCE = -8;
const MOVE_SPEED = 4;
const GAME_WIDTH = 900;
const GAME_HEIGHT = 500; // プレイフィールドの高さ
const CONTROL_ZONE_HEIGHT = 90; // 操作ボタン専用エリアの高さ(プレイフィールドの外)
const CANVAS_TOTAL_HEIGHT = GAME_HEIGHT + CONTROL_ZONE_HEIGHT;
const LAYOUT_STORAGE_KEY = "mini-platformer-layout";

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

  const [layout, setLayout] = useState<"default" | "swapped">("default");
  const [showSettings, setShowSettings] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [displaySize, setDisplaySize] = useState({ width: GAME_WIDTH, height: CANVAS_TOTAL_HEIGHT });
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    setIsTouch(mq.matches);
    const handleChange = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    function updateSize() {
      const ratio = GAME_WIDTH / CANVAS_TOTAL_HEIGHT;
      const landscape = window.innerWidth > window.innerHeight;
      setIsLandscape(landscape);
      // 横画面ではタイトル・説明文を省スペース表示にするので、その分の余白を少なくできる
      const headerReserve = landscape ? 50 : 170;
      const availableW = Math.min(window.innerWidth - 16, 1300);
      const availableH = Math.max(180, window.innerHeight - headerReserve);

      let w = availableW;
      let h = w / ratio;
      if (h > availableH) {
        h = availableH;
        w = h * ratio;
      }
      setDisplaySize({ width: Math.round(w), height: Math.round(h) });
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    window.addEventListener("orientationchange", updateSize);
    return () => {
      window.removeEventListener("resize", updateSize);
      window.removeEventListener("orientationchange", updateSize);
    };
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (saved === "default" || saved === "swapped") {
        setLayout(saved);
      }
    } catch {
      // localStorageが使えない環境では無視
    }
  }, []);

  const changeLayout = (value: "default" | "swapped") => {
    setLayout(value);
    try {
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, value);
    } catch {
      // 無視
    }
  };

  const handleRestart = () => {
    setStatus("playing");
    setCoinCount(0);
    setDefeatedCount(0);
    setResetKey((k) => k + 1);
  };

  const pressKey = (key: string) => {
    keysRef.current[key] = true;
  };
  const releaseKey = (key: string) => {
    keysRef.current[key] = false;
  };

  // ゲームループ本体
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

      // 全体の下地(操作エリア部分の色)
      ctx.fillStyle = "#334155";
      ctx.fillRect(0, 0, GAME_WIDTH, CANVAS_TOTAL_HEIGHT);

      // プレイフィールドの空
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

      // プレイフィールドと操作エリアの境界線
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, GAME_HEIGHT, GAME_WIDTH, 4);
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

  // 長押しメニュー(コピー/ペースト等)を極力出さないための共通設定
  const noCalloutStyle: React.CSSProperties = {
    WebkitUserSelect: "none",
    WebkitTouchCallout: "none",
    userSelect: "none",
    touchAction: "none",
  };

  const touchBtnClass =
    "select-none touch-none flex items-center justify-center rounded-full bg-white/20 text-white active:bg-white/35 border border-white/30 backdrop-blur-sm";

  const moveOnRight = layout === "default";

  const MoveCluster = (
    <div className="flex items-center gap-2">
      <button
        style={noCalloutStyle}
        className={`${touchBtnClass} h-11 w-11 text-base`}
        onPointerDown={(e) => {
          e.preventDefault();
          pressKey("ArrowLeft");
        }}
        onPointerUp={() => releaseKey("ArrowLeft")}
        onPointerLeave={() => releaseKey("ArrowLeft")}
        onPointerCancel={() => releaseKey("ArrowLeft")}
        onContextMenu={(e) => e.preventDefault()}
      >
        ◀
      </button>
      <button
        style={noCalloutStyle}
        className={`${touchBtnClass} h-11 w-11 text-base`}
        onPointerDown={(e) => {
          e.preventDefault();
          pressKey("ArrowRight");
        }}
        onPointerUp={() => releaseKey("ArrowRight")}
        onPointerLeave={() => releaseKey("ArrowRight")}
        onPointerCancel={() => releaseKey("ArrowRight")}
        onContextMenu={(e) => e.preventDefault()}
      >
        ▶
      </button>
    </div>
  );

  const JumpButton = (
    <button
      style={noCalloutStyle}
      className={`${touchBtnClass} h-12 w-12 text-[10px] font-bold`}
      onPointerDown={(e) => {
        e.preventDefault();
        pressKey(" ");
      }}
      onPointerUp={() => releaseKey(" ")}
      onPointerLeave={() => releaseKey(" ")}
      onPointerCancel={() => releaseKey(" ")}
      onContextMenu={(e) => e.preventDefault()}
    >
      JUMP
    </button>
  );

  const controlZoneDisplayHeight =
    displaySize.height * (CONTROL_ZONE_HEIGHT / CANVAS_TOTAL_HEIGHT);

  return (
    <div className="flex min-h-screen flex-col items-center bg-slate-800 p-4">
      <div className="flex w-full max-w-[1100px] items-center justify-between">
        <h1
          className={`font-bold text-white ${
            isTouch && isLandscape ? "text-sm" : "text-lg sm:text-2xl"
          }`}
        >
          ミニ・プラットフォーマー
        </h1>
        <button
          onClick={() => setShowSettings(true)}
          className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          aria-label="設定"
        >
          ⚙️
        </button>
      </div>

      {isTouch ? (
        !isLandscape && (
          <p className="mt-1 text-center text-xs text-slate-300">
            画面下のボタンで操作できます。敵は上から踏むと倒せます。
          </p>
        )
      ) : (
        <p className="mt-1 text-sm text-slate-300">
          矢印キー(または A / D)で移動、スペースキー(または W)でジャンプ。敵は上から踏むと倒せます。コインを集めて旗まで到達しよう。
        </p>
      )}

      <div
        className={`relative overflow-hidden rounded-xl border-4 border-slate-600 shadow-2xl ${
          isTouch && isLandscape ? "mt-1" : "mt-4"
        }`}
        style={{ width: displaySize.width, height: displaySize.height }}
      >
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={CANVAS_TOTAL_HEIGHT}
          style={{ width: displaySize.width, height: displaySize.height }}
          className="block bg-white"
        />

        <div className="absolute left-3 top-3 flex items-center gap-3 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white sm:text-sm">
          <span>🪙 {coinCount} / {initialCoins.length}</span>
          <span>👾 {defeatedCount} / {initialEnemies.length}</span>
        </div>

        {status === "cleared" && (
          <div
            className="absolute inset-x-0 top-0 flex flex-col items-center justify-center gap-3 bg-black/70 px-4 text-center"
            style={{ height: displaySize.height - controlZoneDisplayHeight }}
          >
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
            {!isTouch && (
              <p className="text-xs text-slate-300">
                (Enter または スペースキーでもリスタートできます)
              </p>
            )}
          </div>
        )}

        {status === "gameover" && (
          <div
            className="absolute inset-x-0 top-0 flex flex-col items-center justify-center gap-3 bg-black/70"
            style={{ height: displaySize.height - controlZoneDisplayHeight }}
          >
            <p className="text-3xl font-bold text-red-400">GAME OVER</p>
            <button
              onClick={handleRestart}
              className="rounded-full bg-white px-6 py-2 font-medium text-slate-900 hover:bg-slate-200"
            >
              もう一度プレイ
            </button>
            {!isTouch && (
              <p className="text-xs text-slate-300">
                (Enter または スペースキーでもリスタートできます)
              </p>
            )}
          </div>
        )}

        {/* 操作エリア(キャンバス下部、プレイフィールドとは完全に別のゾーン) */}
        {isTouch && (
          <div
            className="absolute inset-x-0 bottom-0 flex items-center justify-between px-4"
            style={{ height: controlZoneDisplayHeight }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div>{moveOnRight ? JumpButton : MoveCluster}</div>
            <div>{moveOnRight ? MoveCluster : JumpButton}</div>
          </div>
        )}
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 p-5 text-white shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">操作設定</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-white"
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>

            <p className="mb-3 text-sm text-slate-300">
              スマートフォンでのボタン配置を選べます。
            </p>

            <div className="flex flex-col gap-3">
              <label
                className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 ${
                  layout === "default"
                    ? "border-purple-400 bg-purple-500/20"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <div>
                  <p className="font-medium">デフォルト</p>
                  <p className="text-xs text-slate-400">右:移動 / 左:ジャンプ</p>
                </div>
                <input
                  type="radio"
                  name="layout"
                  checked={layout === "default"}
                  onChange={() => changeLayout("default")}
                />
              </label>

              <label
                className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 ${
                  layout === "swapped"
                    ? "border-purple-400 bg-purple-500/20"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <div>
                  <p className="font-medium">入れ替え</p>
                  <p className="text-xs text-slate-400">左:移動 / 右:ジャンプ</p>
                </div>
                <input
                  type="radio"
                  name="layout"
                  checked={layout === "swapped"}
                  onChange={() => changeLayout("swapped")}
                />
              </label>
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className="mt-5 w-full rounded-full bg-white px-4 py-2 font-medium text-slate-900 hover:bg-slate-200"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}