import type { ActionVisualAnimationSchema } from "~/v0/play/action/ActionVisualAnimationSchema";
import type { TileExitMotionSchema } from "~/v0/tile-engine/TileExitMotionSchema";

export const toTileExitMotion = (
	animation: ActionVisualAnimationSchema.Type,
): TileExitMotionSchema.Type => ({
	kind: "merge-out",
	delayMs: animation.delayMs,
	durationMs: animation.durationMs,
	groupId: animation.groupId,
});
