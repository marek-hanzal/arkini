import type { ActionVisualAnimationSchema } from "~/v0/play/action/ActionVisualAnimationSchema";
import type { TileExitMotionSchema } from "~/v0/tile-engine";

export const toTileEngineExitMotion = (
	animation: ActionVisualAnimationSchema.Type,
): TileExitMotionSchema.Type => ({
	kind: animation.effect === "replace" ? "replace-out" : "merge-out",
	delayMs: animation.delayMs,
	durationMs: animation.durationMs,
	groupId: animation.groupId,
});
