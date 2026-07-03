import { TileEngineTiming } from "~/tile-engine/TileEngineTiming";

export const tileRemoveDurationMs = 260;

export const tileRemoveDurationSeconds = tileRemoveDurationMs / 1000;

export const tileRemoveMotionScope = (tileId: string) => `tile-remove:${tileId}`;

export const tileRemoveKeyframes = {
	opacity: [
		1,
		0.72,
		0,
	],
	filter: [
		"brightness(1) saturate(1)",
		"brightness(1.22) saturate(0.85)",
		"brightness(0.8) saturate(0.35)",
	],
	transform: [
		"translate3d(0px, 0px, 0px) scale(1)",
		"translate3d(0px, -3px, 0px) scale(1.06)",
		"translate3d(0px, 5px, 0px) scale(0.58)",
	],
} as const;

export const tileRemoveCleanupDelayMs =
	tileRemoveDurationMs + TileEngineTiming.motionCleanupBufferMs;
