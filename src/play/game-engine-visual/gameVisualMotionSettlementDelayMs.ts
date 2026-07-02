import type { GameVisualMotion } from "~/play/game-engine-visual/GameVisualMotion";
import { TileEngineTiming } from "~/tile-engine";

export const gameVisualMotionSettlementDelayMs = (motion: GameVisualMotion) =>
	(motion.delayMs ?? 0) +
	(motion.durationMs ?? TileEngineTiming.presenceDurationSeconds * 1000) +
	TileEngineTiming.motionCleanupBufferMs;
