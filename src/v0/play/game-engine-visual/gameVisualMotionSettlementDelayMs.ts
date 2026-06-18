import type { GameVisualMotion } from "~/v0/play/game-engine-visual/GameVisualMotion";
import { TileEngineTiming } from "~/v0/tile-engine";

export const gameVisualMotionSettlementDelayMs = (motion: GameVisualMotion) =>
	(motion.delayMs ?? 0) +
	(motion.durationMs ?? TileEngineTiming.presenceDurationSeconds * 1000) +
	TileEngineTiming.motionCleanupBufferMs;
