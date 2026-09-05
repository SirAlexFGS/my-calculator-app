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

// 落下床(クランブル床)のタイミング調整
const FALLING_SHAKE_FRAMES = 24; // 乗ってから崩落するまでのフレーム数(約0.4秒)
const FALLING_RESPAWN_FRAMES = 150; // 崩落してから復活するまでのフレーム数(約2.5秒)

type Platform = { x: number; y: number; w: number; h: number };
type CoinDef = { x: number; y: number; r: number };
type EnemyDef = {
  x: number;
  y: number;
  w: number;
  h: number;
  dir: number;
  range: [number, number];
  speed?: number; // 未指定時は1.5(従来通り)
};
type SpikeDef = { x: number; y: number; w: number; h: number };
type FallingPlatformDef = { x: number; y: number; w: number; h: number };

// 実行時に使う型(クリア済み・生存フラグつき)
type Coin = CoinDef & { collected: boolean };
type Enemy = EnemyDef & { alive: boolean };
type FallingPlatform = FallingPlatformDef & {
  state: "idle" | "shaking" | "fallen";
  timer: number;
};

// ==== ステージ定義 ====
// 新しいステージを追加するときは、この配列に要素を1つ足すだけでOK。
type Stage = {
  name: string;
  theme: "day" | "cave";
  startX: number;
  startY: number;
  platforms: Platform[];
  spikes: SpikeDef[];
  fallingPlatforms: FallingPlatformDef[];
  coins: CoinDef[];
  enemies: EnemyDef[];
  goalX: number;
  goalY: number;
};

const stages: Stage[] = [
  {
    name: "ステージ1",
    theme: "day",
    startX: 50,
    startY: 400,
    platforms: [
      { x: 0, y: 460, w: 300, h: 40 },
      { x: 380, y: 460, w: 200, h: 40 },
      { x: 620, y: 380, w: 150, h: 20 },
      { x: 820, y: 460, w: 400, h: 40 },
      { x: 1300, y: 400, w: 150, h: 20 },
      { x: 1550, y: 460, w: 300, h: 40 },
      { x: 1950, y: 350, w: 200, h: 20 },
      { x: 2250, y: 460, w: 400, h: 40 },
    ],
    spikes: [],
    fallingPlatforms: [],
    coins: [
      { x: 450, y: 420, r: 10 },
      { x: 650, y: 340, r: 10 },
      { x: 900, y: 420, r: 10 },
      { x: 1350, y: 360, r: 10 },
      { x: 1650, y: 420, r: 10 },
      { x: 2000, y: 310, r: 10 },
    ],
    enemies: [
      { x: 850, y: 420, w: 30, h: 30, dir: 1, range: [820, 1180] },
      { x: 1600, y: 420, w: 30, h: 30, dir: 1, range: [1550, 1800] },
    ],
    goalX: 2550,
    goalY: 380,
  },
  {
    name: "ステージ2:深夜の洞窟",
    theme: "cave",
    startX: 50,
    startY: 400,
    platforms: [
      { x: 0, y: 460, w: 220, h: 40 },
      { x: 340, y: 460, w: 90, h: 40 },
      { x: 520, y: 390, w: 70, h: 20 },
      { x: 700, y: 460, w: 90, h: 40 },
      { x: 1010, y: 380, w: 70, h: 20 },
      { x: 1180, y: 460, w: 250, h: 40 },
      { x: 1520, y: 400, w: 70, h: 20 },
      { x: 1850, y: 420, w: 90, h: 40 },
      { x: 2020, y: 460, w: 250, h: 40 },
      { x: 2360, y: 380, w: 70, h: 20 },
      { x: 2690, y: 460, w: 100, h: 40 },
      { x: 2880, y: 400, w: 80, h: 20 },
      { x: 3050, y: 460, w: 350, h: 40 },
    ],
    spikes: [
      { x: 150, y: 440, w: 40, h: 20 }, // 序盤の導入用(避けやすい位置)
      { x: 1280, y: 440, w: 40, h: 20 }, // 幅広床の真ん中を塞ぐ
      { x: 2120, y: 440, w: 40, h: 20 }, // 幅広床の真ん中を塞ぐ
      { x: 2880, y: 380, w: 80, h: 20 }, // 狭い足場をほぼ全部塞ぐ(飛び越え必須)
    ],
    fallingPlatforms: [
      { x: 840, y: 420, w: 90, h: 30 },
      { x: 1680, y: 460, w: 80, h: 30 },
      { x: 2520, y: 420, w: 80, h: 30 },
    ],
    coins: [
      { x: 190, y: 400, r: 10 },
      { x: 385, y: 420, r: 10 },
      { x: 555, y: 350, r: 10 },
      { x: 880, y: 380, r: 10 },
      { x: 1045, y: 340, r: 10 },
      { x: 1300, y: 400, r: 10 },
      { x: 1720, y: 420, r: 10 },
      { x: 2150, y: 400, r: 10 },
      { x: 2560, y: 380, r: 10 },
      { x: 2915, y: 330, r: 10 },
    ],
    enemies: [
      { x: 100, y: 430, w: 30, h: 30, dir: 1, range: [10, 190], speed: 1.3 },
      { x: 1200, y: 430, w: 30, h: 30, dir: 1, range: [1190, 1400], speed: 1.7 },
      { x: 2040, y: 430, w: 30, h: 30, dir: 1, range: [2030, 2240], speed: 1.8 },
      { x: 3080, y: 430, w: 30, h: 30, dir: 1, range: [3060, 3350], speed: 2.0 },
    ],
    goalX: 3320,
    goalY: 380,
  },
  // 今後ここに { name: "ステージ3", ... } のように追加していく
];

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef<{ [key: string]: boolean }>({});

  const [stageIndex, setStageIndex] = useState(0);
  const [status, setStatus] = useState<"playing" | "stagecleared" | "allcleared" | "gameover">("playing");
  const [coinCount, setCoinCount] = useState(0);
  const [defeatedCount, setDefeatedCount] = useState(0);
  const [resetKey, setResetKey] = useState(0);

  const [layout, setLayout] = useState<"default" | "swapped">("default");
  const [showSettings, setShowSettings] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [displaySize, setDisplaySize] = useState({ width: GAME_WIDTH, height: CANVAS_TOTAL_HEIGHT });
  const [isLandscape, setIsLandscape] = useState(false);

  const currentStage = stages[stageIndex];
  const isLastStage = stageIndex === stages.length - 1;

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
      // 無視
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

  // 今のステージをもう一度プレイ
  const handleRestart = () => {
    setStatus("playing");
    setCoinCount(0);
    setDefeatedCount(0);
    setResetKey((k) => k + 1);
  };

  // 次のステージへ進む
  const handleNextStage = () => {
    setStageIndex((i) => Math.min(i + 1, stages.length - 1));
    setStatus("playing");
    setCoinCount(0);
    setDefeatedCount(0);
    setResetKey((k) => k + 1);
  };

  // 最初からやり直す(全クリア後など)
  const handleRestartFromBeginning = () => {
    setStageIndex(0);
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

  // ゲームループ本体(ステージが変わるたびに作り直す)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const stage = stages[stageIndex];
    const isCave = stage.theme === "cave";

    const player = {
      x: stage.startX,
      y: stage.startY,
      w: 30,
      h: 30,
      vx: 0,
      vy: 0,
      onGround: false,
    };

    const coins: Coin[] = stage.coins.map((c) => ({ ...c, collected: false }));
    const enemies: Enemy[] = stage.enemies.map((e) => ({ ...e, alive: true }));
    const spikes: SpikeDef[] = stage.spikes;
    const fallingPlatforms: FallingPlatform[] = stage.fallingPlatforms.map((fp) => ({
      ...fp,
      state: "idle" as const,
      timer: 0,
    }));
    const platforms = stage.platforms;
    const GOAL_X = stage.goalX;
    const GOAL_Y = stage.goalY;

    let cameraX = 0;
    let collected = 0;
    let defeated = 0;
    let frameCount = 0;
    let currentStatus: "playing" | "stagecleared" | "allcleared" | "gameover" = "playing";
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
      frameCount += 1;

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

      // 落下床(崩落前・崩落中は通常の足場として扱う)
      for (const fp of fallingPlatforms) {
        if (fp.state === "fallen") continue;
        if (
          checkAABB(player.x, player.y, player.w, player.h, fp.x, fp.y, fp.w, fp.h)
        ) {
          if (player.vy > 0 && prevBottom - player.vy <= fp.y + 5) {
            player.y = fp.y - player.h;
            player.vy = 0;
            player.onGround = true;
            if (fp.state === "idle") {
              fp.state = "shaking";
              fp.timer = 0;
            }
          }
        }
      }

      // 落下床の状態遷移(乗っているかどうかに関わらず時間経過で進む)
      for (const fp of fallingPlatforms) {
        if (fp.state === "shaking") {
          fp.timer += 1;
          if (fp.timer >= FALLING_SHAKE_FRAMES) {
            fp.state = "fallen";
            fp.timer = 0;
          }
        } else if (fp.state === "fallen") {
          fp.timer += 1;
          if (fp.timer >= FALLING_RESPAWN_FRAMES) {
            fp.state = "idle";
            fp.timer = 0;
          }
        }
      }

      if (player.x < 0) player.x = 0;

      // トゲ(触れた瞬間に即アウト。踏み判定なし)
      for (const sp of spikes) {
        if (
          checkAABB(player.x, player.y, player.w, player.h, sp.x, sp.y, sp.w, sp.h)
        ) {
          currentStatus = "gameover";
          setStatus("gameover");
        }
      }

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

        const speed = en.speed ?? 1.5;
        en.x += en.dir * speed;
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
        const lastStage = stageIndex === stages.length - 1;
        currentStatus = lastStage ? "allcleared" : "stagecleared";
        setStatus(currentStatus);
      }

      cameraX = player.x - 200;
      if (cameraX < 0) cameraX = 0;
    }

    function draw() {
      if (!ctx) return;

      ctx.fillStyle = "#334155";
      ctx.fillRect(0, 0, GAME_WIDTH, CANVAS_TOTAL_HEIGHT);

      const skyTop = isCave ? "#0f172a" : "#87ceeb";
      const skyBottom = isCave ? "#312e81" : "#e0f7fa";
      const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
      gradient.addColorStop(0, skyTop);
      gradient.addColorStop(1, skyBottom);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      ctx.save();
      ctx.translate(-cameraX, 0);

      // 洞窟テーマ用の背景装飾(鍾乳石のシルエット)
      if (isCave) {
        const levelWidth = GOAL_X + 400;
        for (let dx = 0; dx < levelWidth; dx += 220) {
          const h = 30 + ((dx / 220) % 3) * 15;
          ctx.fillStyle = "rgba(15, 23, 42, 0.55)";
          ctx.beginPath();
          ctx.moveTo(dx, 0);
          ctx.lineTo(dx + 40, 0);
          ctx.lineTo(dx + 20, h);
          ctx.closePath();
          ctx.fill();
        }
      }

      const platformBody = isCave ? "#57534e" : "#8d6e63";
      const platformTop = isCave ? "#22d3ee" : "#4caf50";

      ctx.fillStyle = platformBody;
      for (const p of platforms) {
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = platformTop;
        ctx.fillRect(p.x, p.y, p.w, 8);
        ctx.fillStyle = platformBody;
      }

      // 落下床(状態によって見た目を変える。崩落中は描画しない)
      for (const fp of fallingPlatforms) {
        if (fp.state === "fallen") continue;
        let drawX = fp.x;
        if (fp.state === "shaking") {
          drawX += frameCount % 2 === 0 ? 2 : -2;
        }
        ctx.fillStyle = fp.state === "shaking" ? "#f97316" : "#78716c";
        ctx.fillRect(drawX, fp.y, fp.w, fp.h);
        ctx.fillStyle = fp.state === "shaking" ? "#fb923c" : "#a8a29e";
        ctx.fillRect(drawX, fp.y, fp.w, 6);
      }

      // トゲ(三角形の連続で描画)
      ctx.fillStyle = "#dc2626";
      for (const sp of spikes) {
        const spikeCount = Math.max(1, Math.floor(sp.w / 20));
        const spikeWidth = sp.w / spikeCount;
        for (let i = 0; i < spikeCount; i++) {
          const bx = sp.x + i * spikeWidth;
          ctx.beginPath();
          ctx.moveTo(bx, sp.y + sp.h);
          ctx.lineTo(bx + spikeWidth / 2, sp.y);
          ctx.lineTo(bx + spikeWidth, sp.y + sp.h);
          ctx.closePath();
          ctx.fill();
        }
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
  }, [resetKey, stageIndex]);

  // クリア・ゲームオーバー時のキーボード操作対応
  useEffect(() => {
    function handleActionKey(e: KeyboardEvent) {
      if (e.key !== "Enter" && e.key !== " ") return;
      if (status === "gameover") {
        e.preventDefault();
        handleRestart();
      } else if (status === "stagecleared") {
        e.preventDefault();
        handleNextStage();
      } else if (status === "allcleared") {
        e.preventDefault();
        handleRestartFromBeginning();
      }
    }
    window.addEventListener("keydown", handleActionKey);
    return () => window.removeEventListener("keydown", handleActionKey);
  }, [status]);

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

  const overlayHeight = displaySize.height - controlZoneDisplayHeight;

  return (
    <div className="flex min-h-screen flex-col items-center bg-slate-800 p-4">
      <div className="flex w-full max-w-[1100px] items-center justify-between">
        <h1
          className={`font-bold text-white ${
            isTouch && isLandscape ? "text-sm" : "text-lg sm:text-2xl"
          }`}
        >
          ミニ・プラットフォーマー ({currentStage.name})
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
            画面下のボタンで操作できます。敵は上から踏むと倒せます。トゲや崩れる床には注意しましょう。
          </p>
        )
      ) : (
        <p className="mt-1 text-sm text-slate-300">
          矢印キー(または A / D)で移動、スペースキー(または W)でジャンプ。敵は上から踏むと倒せますが、トゲに触れると即ミス、崩れる床は長居禁物です。コインを集めて旗まで到達しよう。
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
          <span>🪙 {coinCount} / {currentStage.coins.length}</span>
          <span>👾 {defeatedCount} / {currentStage.enemies.length}</span>
        </div>

        {status === "stagecleared" && (
          <div
            className="absolute inset-x-0 top-0 flex flex-col items-center justify-center gap-3 bg-black/70 px-4 text-center"
            style={{ height: overlayHeight }}
          >
            <p className="text-3xl font-bold text-yellow-300">🎉 STAGE CLEAR!</p>
            <p className="text-white">
              コイン獲得数: {coinCount} / {currentStage.coins.length}
            </p>
            <p className="text-white">
              倒した敵: {defeatedCount} / {currentStage.enemies.length}
            </p>
            <button
              onClick={handleNextStage}
              className="rounded-full bg-white px-6 py-2 font-medium text-slate-900 hover:bg-slate-200"
            >
              次のステージへ
            </button>
            {!isTouch && (
              <p className="text-xs text-slate-300">
                (Enter または スペースキーでも次に進めます)
              </p>
            )}
          </div>
        )}

        {status === "allcleared" && (
          <div
            className="absolute inset-x-0 top-0 flex flex-col items-center justify-center gap-3 bg-black/70 px-4 text-center"
            style={{ height: overlayHeight }}
          >
            <p className="text-3xl font-bold text-yellow-300">🏆 ALL CLEAR!</p>
            <p className="text-white">全ステージクリアおめでとう!</p>
            <button
              onClick={handleRestartFromBeginning}
              className="rounded-full bg-white px-6 py-2 font-medium text-slate-900 hover:bg-slate-200"
            >
              最初からもう一度
            </button>
            {!isTouch && (
              <p className="text-xs text-slate-300">
                (Enter または スペースキーでも最初からになります)
              </p>
            )}
          </div>
        )}

        {status === "gameover" && (
          <div
            className="absolute inset-x-0 top-0 flex flex-col items-center justify-center gap-3 bg-black/70"
            style={{ height: overlayHeight }}
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