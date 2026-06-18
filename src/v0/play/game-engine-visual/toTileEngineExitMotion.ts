import type { GameVisualMotion } from "~/v0/play/game-engine-visual/GameVisualMotion";
import type { TileExitMotionSchema } from "~/v0/tile-engine";

export const toTileEngineExitMotion = (motion: GameVisualMotion): TileExitMotionSchema.Type => ({
	kind: motion.effect === "replace" ? "replace-out" : "merge-out",
	delayMs: motion.delayMs,
	durationMs: motion.durationMs,
	groupId: motion.groupId,
});
