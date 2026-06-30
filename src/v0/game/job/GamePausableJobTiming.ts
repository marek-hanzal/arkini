export type GamePausableJobTiming = {
	delivery?: {
		nextAttemptAtMs: number;
	};
	pausedAtMs?: number;
	readyAtMs: number;
	remainingMs?: number;
	startAtMs: number;
};

export const isGamePausableJobPaused = (job: GamePausableJobTiming) =>
	job.pausedAtMs !== undefined && job.remainingMs !== undefined;

export const readGamePausableJobWakeAtMs = (job: GamePausableJobTiming) =>
	isGamePausableJobPaused(job) ? undefined : (job.delivery?.nextAttemptAtMs ?? job.readyAtMs);

const readGamePausableJobShiftedReadyAtMs = ({
	job,
	startAtMs,
}: {
	job: GamePausableJobTiming;
	startAtMs: number;
}) => Math.max(startAtMs, job.readyAtMs + (startAtMs - job.startAtMs));

export const readGamePausableJobRemainingMsAtPause = ({
	job,
	nowMs,
	startAtMs = job.startAtMs,
}: {
	job: GamePausableJobTiming;
	nowMs: number;
	startAtMs?: number;
}) =>
	Math.max(
		0,
		readGamePausableJobShiftedReadyAtMs({
			job,
			startAtMs,
		}) - Math.max(nowMs, startAtMs),
	);

export const readGamePausableJobResumedTiming = ({
	durationMs,
	nowMs,
	remainingMs,
}: {
	durationMs: number;
	nowMs: number;
	remainingMs: number;
}) => {
	const startAtMs = nowMs - Math.max(0, durationMs - remainingMs);
	return {
		readyAtMs: startAtMs + durationMs,
		startAtMs,
	};
};
