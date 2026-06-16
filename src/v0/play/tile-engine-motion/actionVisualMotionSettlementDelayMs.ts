import type { ActionVisualAnimationSchema } from "~/v0/play/action/ActionVisualAnimationSchema";
import { TileEngineTiming } from "~/v0/tile-engine/TileEngineTiming";

export const actionVisualMotionSettlementDelayMs = (animation: ActionVisualAnimationSchema.Type) =>
	(animation.delayMs ?? 0) +
	(animation.durationMs ?? TileEngineTiming.presenceDurationSeconds * 1000) +
	TileEngineTiming.motionCleanupBufferMs;
