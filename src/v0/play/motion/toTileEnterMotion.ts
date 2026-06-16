import type { ActionVisualAnimationSchema } from "~/v0/play/action/ActionVisualAnimationSchema";
import type { TileEnterMotionSchema } from "~/v0/tile-engine/TileEnterMotionSchema";

export const toTileEnterMotion = (
	animation?: ActionVisualAnimationSchema.Type,
): TileEnterMotionSchema.Type => ({
	kind: animation?.effect === "fade-in" ? "fade-in" : "pop-in",
	durationMs: animation?.durationMs,
});
