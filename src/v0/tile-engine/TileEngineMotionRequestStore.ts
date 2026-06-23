import { useSyncExternalStore } from "react";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import type { TileEngineMotionSchema } from "~/v0/tile-engine/TileEngineMotionSchema";
import type { TileEngineMotionRequest } from "~/v0/tile-engine/TileEngineMotionRequest";
import { TileEngineTiming } from "~/v0/tile-engine/TileEngineTiming";

type MotionMap = ReadonlyMap<string, TileEngineMotionSchema.Type>;
type MutableMotionMap = Map<string, TileEngineMotionSchema.Type>;

const emptyMotionMap: MotionMap = new Map();

let motionsByEngineId = new Map<string, MotionMap>();
const listeners = new Set<() => void>();

const notify = () => {
	for (const listener of listeners) listener();
};

const cloneEngineMotionMap = (engineId: string): MutableMotionMap =>
	new Map(motionsByEngineId.get(engineId) ?? emptyMotionMap);

const storeEngineMotionMap = (engineId: string, motions: MutableMotionMap) => {
	const next = new Map(motionsByEngineId);
	if (motions.size === 0) {
		next.delete(engineId);
	} else {
		next.set(engineId, motions);
	}
	motionsByEngineId = next;
	notify();
};

const isEmptyMotion = (motion: TileEngineMotionSchema.Type) =>
	!motion.enter && !motion.exit && !motion.feedback;

const clearTileEngineMotionRequest = ({
	engineId,
	kind,
	motion,
	tileId,
}: {
	engineId: string;
	kind: "enter" | "exit" | "feedback";
	motion:
		| NonNullable<TileEngineMotionSchema.Type["enter"]>
		| NonNullable<TileEngineMotionSchema.Type["exit"]>
		| NonNullable<TileEngineMotionSchema.Type["feedback"]>;
	tileId: string;
}) => {
	const current = motionsByEngineId.get(engineId);
	const currentTileMotion = current?.get(tileId);
	if (!current || !currentTileMotion || currentTileMotion[kind] !== motion) return;

	const nextTileMotion = {
		...currentTileMotion,
		[kind]: undefined,
	};
	const motions = new Map(current);
	if (isEmptyMotion(nextTileMotion)) {
		motions.delete(tileId);
	} else {
		motions.set(tileId, nextTileMotion);
	}

	DebugTimeline.record({
		scope: "tile-engine",
		event: "motion.request.settle",
		detail: {
			engineId,
			groupId: motion.groupId,
			kind,
			tileId,
		},
	});
	storeEngineMotionMap(engineId, motions);
};

const scheduleTileEngineMotionRequestCleanup = ({
	cleanupDelayMs,
	engineId,
	request,
}: {
	cleanupDelayMs: number | undefined;
	engineId: string;
	request: TileEngineMotionRequest;
}) => {
	if (cleanupDelayMs === undefined) return;

	const { enter, exit, feedback, tileId } = request;
	globalThis.setTimeout(() => {
		if (enter) {
			clearTileEngineMotionRequest({
				engineId,
				kind: "enter",
				motion: enter,
				tileId,
			});
		}
		if (exit) {
			clearTileEngineMotionRequest({
				engineId,
				kind: "exit",
				motion: exit,
				tileId,
			});
		}
		if (feedback) {
			clearTileEngineMotionRequest({
				engineId,
				kind: "feedback",
				motion: feedback,
				tileId,
			});
		}
	}, cleanupDelayMs);
};

export const subscribeTileEngineMotionRequests = (listener: () => void) => {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
};

export const readTileEngineMotionRequests = (engineId: string): MotionMap =>
	motionsByEngineId.get(engineId) ?? emptyMotionMap;

export const useTileEngineMotionRequests = (engineId: string): MotionMap =>
	useSyncExternalStore(
		subscribeTileEngineMotionRequests,
		() => readTileEngineMotionRequests(engineId),
		() => readTileEngineMotionRequests(engineId),
	);

const feedbackTotalDurationMs = (feedback: NonNullable<TileEngineMotionSchema.Type["feedback"]>) =>
	(feedback.durationMs ?? TileEngineTiming.feedbackDurationSeconds * 1000) *
	(feedback.pulseCount ?? 1);

const isFeedbackOnlyRequest = (request: TileEngineMotionRequest) =>
	Boolean(request.feedback) && !request.enter && !request.exit;

const mergeFeedbackRequests = (
	current: TileEngineMotionRequest,
	request: TileEngineMotionRequest,
): TileEngineMotionRequest => {
	if (!current.feedback || !request.feedback) return current;

	const feedback = {
		...request.feedback,
		pulseCount: (current.feedback.pulseCount ?? 1) + (request.feedback.pulseCount ?? 1),
	};
	const feedbackCleanupDelayMs =
		(feedback.delayMs ?? 0) +
		feedbackTotalDurationMs(feedback) +
		TileEngineTiming.motionCleanupBufferMs;

	return {
		...current,
		cleanupDelayMs: Math.max(
			current.cleanupDelayMs ?? 0,
			request.cleanupDelayMs ?? 0,
			feedbackCleanupDelayMs,
		),
		feedback,
	};
};

const normalizeTileEngineMotionRequests = (
	requests: readonly TileEngineMotionRequest[],
): readonly TileEngineMotionRequest[] => {
	const normalized: TileEngineMotionRequest[] = [];
	const feedbackRequestIndexByTileId = new Map<string, number>();

	for (const request of requests) {
		if (!isFeedbackOnlyRequest(request)) {
			normalized.push(request);
			continue;
		}

		const currentIndex = feedbackRequestIndexByTileId.get(request.tileId);
		if (currentIndex === undefined) {
			feedbackRequestIndexByTileId.set(request.tileId, normalized.length);
			normalized.push(request);
			continue;
		}

		normalized[currentIndex] = mergeFeedbackRequests(normalized[currentIndex], request);
	}

	return normalized;
};

export const registerTileEngineMotionRequests = ({
	engineId,
	requests,
}: {
	engineId: string;
	requests: readonly TileEngineMotionRequest[];
}) => {
	if (requests.length === 0) return;

	const normalizedRequests = normalizeTileEngineMotionRequests(requests);
	const motions = cloneEngineMotionMap(engineId);
	let changed = false;
	for (const request of normalizedRequests) {
		if (!request.enter && !request.exit && !request.feedback) continue;

		const current = motions.get(request.tileId) ?? {};
		motions.set(request.tileId, {
			...current,
			...(request.enter
				? {
						enter: request.enter,
					}
				: {}),
			...(request.exit
				? {
						exit: request.exit,
					}
				: {}),
			...(request.feedback
				? {
						feedback: request.feedback,
					}
				: {}),
		});
		changed = true;
	}

	if (!changed) return;

	DebugTimeline.record({
		scope: "tile-engine",
		event: "motion.request.register",
		detail: {
			engineId,
			count: normalizedRequests.length,
			requests: normalizedRequests,
		},
	});
	storeEngineMotionMap(engineId, motions);

	for (const request of normalizedRequests) {
		scheduleTileEngineMotionRequestCleanup({
			cleanupDelayMs: request.cleanupDelayMs,
			engineId,
			request,
		});
	}
};

export const clearTileEngineMotionRequestsByGroup = ({
	engineId,
	groupId,
}: {
	engineId: string;
	groupId: string;
}) => {
	const current = motionsByEngineId.get(engineId);
	if (!current) return;

	const motions = new Map(current);
	let changed = false;
	for (const [tileId, motion] of current) {
		const next = {
			...motion,
			enter: motion.enter?.groupId === groupId ? undefined : motion.enter,
			exit: motion.exit?.groupId === groupId ? undefined : motion.exit,
			feedback: motion.feedback?.groupId === groupId ? undefined : motion.feedback,
		};

		if (
			next.enter === motion.enter &&
			next.exit === motion.exit &&
			next.feedback === motion.feedback
		)
			continue;

		changed = true;
		if (isEmptyMotion(next)) {
			motions.delete(tileId);
		} else {
			motions.set(tileId, next);
		}
	}

	if (!changed) return;

	DebugTimeline.record({
		scope: "tile-engine",
		event: "motion.request.clear",
		detail: {
			engineId,
			groupId,
		},
	});
	storeEngineMotionMap(engineId, motions);
};

export const clearTileEngineMotionRequests = () => {
	if (motionsByEngineId.size === 0) return;

	motionsByEngineId = new Map();
	notify();
};
