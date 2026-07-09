export const tileRemoveDurationMs = 1000;

export const tileRemoveDurationSeconds = tileRemoveDurationMs / 1000;

export const tileRemoveMotionScope = (tileId: string) => `tile-remove:${tileId}`;

export const tileRemoveKeyframes = {
	opacity: [
		1,
		1,
		0.86,
		0.42,
		0,
	],
	filter: [
		"brightness(1) saturate(1) drop-shadow(0 0 0 rgb(168 85 247 / 0))",
		"brightness(1.28) saturate(1.2) drop-shadow(0 10px 18px rgb(168 85 247 / 0.38))",
		"brightness(1.12) saturate(0.95) drop-shadow(0 4px 12px rgb(168 85 247 / 0.26))",
		"brightness(0.96) saturate(0.68) drop-shadow(0 2px 8px rgb(168 85 247 / 0.14))",
		"brightness(0.72) saturate(0.24) drop-shadow(0 0 0 rgb(168 85 247 / 0))",
	],
	transform: [
		"translate3d(0px, 0px, 0px) rotate(0deg) scale(1)",
		"translate3d(0px, -9px, 0px) rotate(-2deg) scale(1.16)",
		"translate3d(0px, 3px, 0px) rotate(2deg) scale(0.96)",
		"translate3d(0px, -5px, 0px) rotate(-1deg) scale(1.07)",
		"translate3d(0px, 12px, 0px) rotate(0deg) scale(0.42)",
	],
} as const;
