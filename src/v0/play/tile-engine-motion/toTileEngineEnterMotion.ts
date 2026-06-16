import type { ActionVisualAnimationSchema } from "~/v0/play/action/ActionVisualAnimationSchema";
import type { TileEnterMotionSchema } from "~/v0/tile-engine";

export namespace toTileEngineEnterMotion {
	export interface Options {
		fromTileId?: string;
	}
}

export const toTileEngineEnterMotion = (
	animation: ActionVisualAnimationSchema.Type,
	options: toTileEngineEnterMotion.Options = {},
): TileEnterMotionSchema.Type => ({
	kind:
		animation.effect === "merge"
			? "merge-in"
			: options.fromTileId
				? "spawn-from-tile"
				: animation.effect === "fade-in"
					? "fade-in"
					: "pop-in",
	delayMs: animation.delayMs,
	durationMs: animation.durationMs,
	sequenceIndex: animation.sequenceIndex,
	fromTileId: options.fromTileId,
	groupId: animation.groupId,
});
