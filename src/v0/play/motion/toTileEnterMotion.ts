import type { ActionVisualAnimationSchema } from "~/v0/play/action/ActionVisualAnimationSchema";
import type { TileEnterMotionSchema } from "~/v0/tile-engine/TileEnterMotionSchema";

export namespace toTileEnterMotion {
	export interface Options {
		fromTileId?: string;
	}
}

export const toTileEnterMotion = (
	animation: ActionVisualAnimationSchema.Type,
	options: toTileEnterMotion.Options = {},
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
