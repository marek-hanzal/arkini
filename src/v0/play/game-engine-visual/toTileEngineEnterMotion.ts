import type { GameVisualMotion } from "~/play/game-engine-visual/GameVisualMotion";
import type { TileEnterMotionSchema } from "~/tile-engine/TileEnterMotionSchema";

export namespace toTileEngineEnterMotion {
	export interface Options {
		fromTileId?: string;
	}
}

export const toTileEngineEnterMotion = (
	motion: GameVisualMotion,
	options: toTileEngineEnterMotion.Options = {},
): TileEnterMotionSchema.Type => ({
	kind:
		motion.effect === "merge" || motion.effect === "replace" || motion.effect === "stage-update"
			? "flip-in"
			: options.fromTileId
				? "spawn-from-tile"
				: "fade-in",
	delayMs: motion.delayMs,
	durationMs: motion.durationMs,
	fromTileId: options.fromTileId,
	groupId: motion.groupId,
	sequenceIndex: motion.sequenceIndex,
});
