import type { CSSProperties } from "react";

interface ConfettiPiece {
  id: number;
  x: string;
  y: string;
  rotation: string;
  color: string;
  delay: string;
}

const CONFETTI_PIECES: ConfettiPiece[] = [
  { id: 1, x: "-8rem", y: "-7rem", rotation: "-260deg", color: "#ffd6a0", delay: "0ms" },
  { id: 2, x: "-5.5rem", y: "-9rem", rotation: "180deg", color: "#bcecff", delay: "40ms" },
  { id: 3, x: "-2rem", y: "-6rem", rotation: "-120deg", color: "#f5b7d5", delay: "80ms" },
  { id: 4, x: "2.5rem", y: "-8.5rem", rotation: "220deg", color: "#ffe4ae", delay: "20ms" },
  { id: 5, x: "6rem", y: "-6.5rem", rotation: "-180deg", color: "#c7f3d0", delay: "100ms" },
  { id: 6, x: "9rem", y: "-3rem", rotation: "260deg", color: "#bcecff", delay: "60ms" },
  { id: 7, x: "7.5rem", y: "1rem", rotation: "-220deg", color: "#ffd6a0", delay: "120ms" },
  { id: 8, x: "5rem", y: "4rem", rotation: "160deg", color: "#f5b7d5", delay: "30ms" },
  { id: 9, x: "1rem", y: "5rem", rotation: "-300deg", color: "#ffe4ae", delay: "90ms" },
  { id: 10, x: "-3rem", y: "4rem", rotation: "200deg", color: "#c7f3d0", delay: "50ms" },
  { id: 11, x: "-7rem", y: "2rem", rotation: "-160deg", color: "#bcecff", delay: "110ms" },
  { id: 12, x: "-9rem", y: "-1rem", rotation: "280deg", color: "#f5b7d5", delay: "70ms" },
];

interface ConfettiOverlayProps {
  burstId: number;
}

export function ConfettiOverlay({ burstId }: ConfettiOverlayProps) {
  return (
    <div key={burstId} className="timer-confetti" aria-hidden="true">
      {CONFETTI_PIECES.map((piece) => (
        <span
          key={piece.id}
          className="timer-confetti-piece"
          style={
            {
              "--confetti-x": piece.x,
              "--confetti-y": piece.y,
              "--confetti-rotation": piece.rotation,
              "--confetti-color": piece.color,
              "--confetti-delay": piece.delay,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
