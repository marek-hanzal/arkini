export const TileEngineTiming = {
	defaultGapPx: 0,
	doubleTapWindowMs: 260,
	longPressMs: 520,
	dragThresholdPx: 8,
	moveDurationSeconds: 0.42,
	snapDurationSeconds: 0.24,
	rejectDurationSeconds: 0.27,
	presenceDurationSeconds: 0.42,
	feedbackDurationSeconds: 1.6,
	motionCleanupBufferMs: 140,
	moveEase: [
		0.22,
		1,
		0.36,
		1,
	] as const,
	rejectEase: [
		0.65,
		0,
		0.35,
		1,
	] as const,
} as const;
