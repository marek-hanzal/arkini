import type { GameVisualMotion } from "~/play/game-engine-visual/GameVisualMotion";
import type { TileEnterMotionSchema } from "~/tile-engine";

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
		motion.effect === "merge"
			? "merge-in"
			: motion.effect === "replace"
				? "replace-in"
				: options.fromTileId
					? "spawn-from-tile"
					: "fade-in",
	delayMs: motion.delayMs,
	durationMs: motion.durationMs,
	fromTileId: options.fromTileId,
	groupId: motion.groupId,
	sequenceIndex: motion.sequenceIndex,
});
