'use client';

import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import p5 from 'p5';

const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 480;
const PADDLE_WIDTH = 112;
const PADDLE_HEIGHT = 14;
const BALL_RADIUS = 8;
const ZST_PATTERN = [
  'XXXX..XXXXX..XXXX',
  '...X....X....X...',
  '..X.....X....X....',
  '.X......X....XXX..',
  'X.......X......X..',
  'X.......X......X..',
  'XXXX....X....XXX..',
] as const;

type ControlKey = 'left' | 'right';

interface GameCommands {
  startOrRestart: () => void;
}

interface Brick {
  active: boolean;
  height: number;
  width: number;
  x: number;
  y: number;
}

function isControlKey(key: string) {
  return key === 'ArrowLeft' || key === 'ArrowRight' || key === ' ' || key === 'Spacebar';
}

export function NotFoundGameCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<Record<ControlKey, boolean>>({ left: false, right: false });
  const commandsRef = useRef<GameCommands>({ startOrRestart: () => undefined });
  const [buttonLabel, setButtonLabel] = useState('Start game');
  const [status, setStatus] = useState('Ready. Focus the game, then press Space or use Start game.');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const instance = new p5((p) => {
      let bricks: Brick[] = [];
      let ballX = CANVAS_WIDTH / 2;
      let ballY = CANVAS_HEIGHT - 64;
      let ballVelocityX = 4;
      let ballVelocityY = -4;
      let paddleX = (CANVAS_WIDTH - PADDLE_WIDTH) / 2;
      let running = false;
      let finished = false;

      const resetBoard = () => {
        const brickWidth = 32;
        const brickHeight = 18;
        const left = (CANVAS_WIDTH - ZST_PATTERN[0].length * brickWidth) / 2;
        const top = 46;
        bricks = [];

        for (const [rowIndex, row] of ZST_PATTERN.entries()) {
          for (const [columnIndex, cell] of [...row].entries()) {
            if (cell !== 'X') continue;
            bricks.push({
              active: true,
              height: brickHeight,
              width: brickWidth,
              x: left + columnIndex * brickWidth,
              y: top + rowIndex * brickHeight,
            });
          }
        }

        ballX = CANVAS_WIDTH / 2;
        ballY = CANVAS_HEIGHT - 64;
        ballVelocityX = 4;
        ballVelocityY = -4;
        paddleX = (CANVAS_WIDTH - PADDLE_WIDTH) / 2;
        running = false;
        finished = false;
        setButtonLabel('Start game');
        setStatus('Ready. Focus the game, then press Space or use Start game.');
      };

      const startOrRestart = () => {
        if (running || finished) resetBoard();
        running = true;
        setButtonLabel('Restart game');
        setStatus('Game running. Use Left and Right Arrow keys to move the paddle.');
        host.focus();
      };

      commandsRef.current.startOrRestart = startOrRestart;

      p.setup = () => {
        const renderer = p.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
        const canvas = renderer.elt as HTMLCanvasElement;
        canvas.className = 'not-found-game-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        p.noStroke();
        resetBoard();
      };

      p.draw = () => {
        const styles = getComputedStyle(document.documentElement);
        const background = styles.getPropertyValue('--canvas').trim() || '#09090a';
        const foreground = styles.getPropertyValue('--text-1').trim() || '#f7f8f8';
        const muted = styles.getPropertyValue('--text-3').trim() || '#8a8f98';
        const accent = styles.getPropertyValue('--ring').trim() || '#4b7bff';

        p.background(background);

        if (controlsRef.current.left) paddleX -= 7;
        if (controlsRef.current.right) paddleX += 7;
        paddleX = Math.max(0, Math.min(CANVAS_WIDTH - PADDLE_WIDTH, paddleX));

        if (running) {
          ballX += ballVelocityX;
          ballY += ballVelocityY;

          if (ballX <= BALL_RADIUS || ballX >= CANVAS_WIDTH - BALL_RADIUS) ballVelocityX *= -1;
          if (ballY <= BALL_RADIUS) ballVelocityY *= -1;

          if (
            ballVelocityY > 0 &&
            ballY + BALL_RADIUS >= CANVAS_HEIGHT - 34 &&
            ballY - BALL_RADIUS <= CANVAS_HEIGHT - 34 + PADDLE_HEIGHT &&
            ballX >= paddleX &&
            ballX <= paddleX + PADDLE_WIDTH
          ) {
            ballY = CANVAS_HEIGHT - 34 - BALL_RADIUS;
            ballVelocityY *= -1;
            ballVelocityX += ((ballX - paddleX) / PADDLE_WIDTH - 0.5) * 1.5;
          }

          for (const brick of bricks) {
            if (
              brick.active &&
              ballX + BALL_RADIUS >= brick.x &&
              ballX - BALL_RADIUS <= brick.x + brick.width &&
              ballY + BALL_RADIUS >= brick.y &&
              ballY - BALL_RADIUS <= brick.y + brick.height
            ) {
              brick.active = false;
              ballVelocityY *= -1;
              break;
            }
          }

          if (bricks.every((brick) => !brick.active)) {
            running = false;
            finished = true;
            setStatus('ZST restored. Use Restart game to play again.');
          } else if (ballY - BALL_RADIUS > CANVAS_HEIGHT) {
            running = false;
            finished = true;
            setStatus('Record still missing. Use Restart game to try again.');
          }
        }

        p.fill(muted);
        for (const brick of bricks) {
          if (brick.active) p.rect(brick.x + 1, brick.y + 1, brick.width - 2, brick.height - 2);
        }

        p.fill(accent);
        p.rect(paddleX, CANVAS_HEIGHT - 34, PADDLE_WIDTH, PADDLE_HEIGHT);
        p.fill(foreground);
        p.circle(ballX, ballY, BALL_RADIUS * 2);
      };
    }, host);

    return () => {
      commandsRef.current.startOrRestart = () => undefined;
      instance.remove();
    };
  }, []);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || !isControlKey(event.key)) return;
    event.preventDefault();
    if (event.key === 'ArrowLeft') controlsRef.current.left = true;
    if (event.key === 'ArrowRight') controlsRef.current.right = true;
    if (event.key === ' ' || event.key === 'Spacebar') commandsRef.current.startOrRestart();
  };

  const handleKeyUp = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || !isControlKey(event.key)) return;
    event.preventDefault();
    if (event.key === 'ArrowLeft') controlsRef.current.left = false;
    if (event.key === 'ArrowRight') controlsRef.current.right = false;
  };

  return (
    <div>
      <div
        ref={hostRef}
        className="not-found-game-focus"
        role="group"
        tabIndex={0}
        aria-label="ZST brick recovery game. Left and Right Arrow keys move. Space starts or restarts."
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
      />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="border border-line-strong bg-canvas px-4 py-2 font-mono text-xs text-text-1 hover:bg-surface-hover"
          onClick={() => commandsRef.current.startOrRestart()}
        >
          {buttonLabel}
        </button>
        <p className="font-mono text-xs text-text-3" aria-live="polite">{status}</p>
      </div>
    </div>
  );
}
