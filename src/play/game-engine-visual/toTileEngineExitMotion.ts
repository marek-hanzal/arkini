import type { GameVisualMotion } from "~/play/game-engine-visual/GameVisualMotion";
import type { TileExitMotionSchema } from "~/tile-engine/TileExitMotionSchema";

export namespace toTileEngineExitMotion {
	export interface Options {
		toTileId?: string;
	}
}

export const toTileEngineExitMotion = (
	motion: GameVisualMotion,
	options: toTileEngineExitMotion.Options = {},
): TileExitMotionSchema.Type => ({
	kind: options.toTileId
		? "fly-to-tile"
		: motion.effect === "replace"
			? "replace-out"
			: "merge-out",
	delayMs: motion.delayMs,
	durationMs: motion.durationMs,
	groupId: motion.groupId,
	toTileId: options.toTileId,
});
