import { animate } from "motion";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import {
	freezeElementVisualState,
	readTileVisualSnapshot,
	type TileVisualSnapshot,
} from "~/v0/tile-engine/TileVisualSnapshot";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export namespace TileMotionRuntime {
	export type Status = "completed" | "cancelled";
	export type StyleKeyframes = Record<string, unknown>;

	export interface Result {
		readonly status: Status;
		readonly snapshot: TileVisualSnapshot.Type;
	}

	export interface StartStyleProps {
		readonly scope: string;
		readonly element: HTMLElement;
		readonly keyframes:
			| StyleKeyframes
			| ((snapshot: TileVisualSnapshot.Type) => StyleKeyframes);
		readonly delay?: number;
		readonly duration: number;
		readonly ease: readonly number[];
		readonly meta?: Record<string, unknown>;
	}

	export interface StartTransformProps {
		readonly scope: string;
		readonly element: HTMLElement;
		readonly from: string | ((snapshot: TileVisualSnapshot.Type) => string);
		readonly to: string | ((snapshot: TileVisualSnapshot.Type) => string);
		readonly duration: number;
		readonly ease: readonly number[];
		readonly meta?: Record<string, unknown>;
	}

	export interface ActiveMotion {
		readonly id: string;
		readonly scope: string;
		readonly element: HTMLElement;
		readonly controls: ReturnType<typeof animate>;
		resolve(result: Result): void;
	}
}

const activeMotions = new Map<string, TileMotionRuntime.ActiveMotion>();

export const tileMotionScope = (tileId: TileEngine.Id) => `tile:${tileId}`;
export const tilePresenceMotionScope = (tileId: TileEngine.Id) => `tile-presence:${tileId}`;

const createMotionId = (scope: string) => `motion:${scope}:${Math.round(performance.now() * 100)}`;

const resolveValue = (
	value: string | ((snapshot: TileVisualSnapshot.Type) => string),
	snapshot: TileVisualSnapshot.Type,
) => (typeof value === "function" ? value(snapshot) : value);

const resolveKeyframes = (
	keyframes:
		| TileMotionRuntime.StyleKeyframes
		| ((snapshot: TileVisualSnapshot.Type) => TileMotionRuntime.StyleKeyframes),
	snapshot: TileVisualSnapshot.Type,
) => (typeof keyframes === "function" ? keyframes(snapshot) : keyframes);

export const cancelTileMotion = (
	scope: string,
	reason = "cancelled",
): TileVisualSnapshot.Type | null => {
	const active = activeMotions.get(scope);
	if (!active) return null;

	active.controls.stop();
	const snapshot = freezeElementVisualState(active.element);
	activeMotions.delete(scope);
	active.resolve({
		status: "cancelled",
		snapshot,
	});

	DebugTimeline.record({
		scope: "tile-engine",
		event: "motion.cancel",
		detail: {
			motionId: active.id,
			scope: active.scope,
			reason,
			transform: snapshot.transform,
			translateX: snapshot.translateX,
			translateY: snapshot.translateY,
		},
	});

	return snapshot;
};

export const startTileStyleMotion = ({
	scope,
	element,
	keyframes,
	delay = 0,
	duration,
	ease,
	meta = {},
}: TileMotionRuntime.StartStyleProps): Promise<TileMotionRuntime.Result> => {
	cancelTileMotion(scope, "replaced");
	const snapshot = readTileVisualSnapshot(element);
	const resolvedKeyframes = resolveKeyframes(keyframes, snapshot);
	const motionId = createMotionId(scope);

	let resolveResult!: (result: TileMotionRuntime.Result) => void;
	const result = new Promise<TileMotionRuntime.Result>((resolve) => {
		resolveResult = resolve;
	});

	DebugTimeline.record({
		scope: "tile-engine",
		event: "motion.runtime.start",
		detail: {
			...meta,
			motionId,
			scope,
			delay,
			duration,
			keyframes: resolvedKeyframes,
		},
	});

	const controls = animate(
		element,
		resolvedKeyframes as Parameters<typeof animate>[1],
		{
			delay,
			duration,
			ease,
		} as Parameters<typeof animate>[2],
	);

	const active: TileMotionRuntime.ActiveMotion = {
		id: motionId,
		scope,
		element,
		controls,
		resolve: resolveResult,
	};
	activeMotions.set(scope, active);

	void controls.then(() => {
		if (activeMotions.get(scope)?.id !== motionId) return;
		activeMotions.delete(scope);
		const finalSnapshot = readTileVisualSnapshot(element);
		resolveResult({
			status: "completed",
			snapshot: finalSnapshot,
		});
		DebugTimeline.record({
			scope: "tile-engine",
			event: "motion.runtime.end",
			detail: {
				...meta,
				motionId,
				scope,
				transform: finalSnapshot.transform,
			},
		});
	});

	return result;
};

export const startTileTransformMotion = ({
	scope,
	element,
	from,
	to,
	duration,
	ease,
	meta = {},
}: TileMotionRuntime.StartTransformProps): Promise<TileMotionRuntime.Result> =>
	startTileStyleMotion({
		scope,
		element,
		keyframes: (snapshot) => ({
			transform: [
				resolveValue(from, snapshot),
				resolveValue(to, snapshot),
			],
		}),
		duration,
		ease,
		meta,
	});

export const cancelTileMotionForElement = (element: HTMLElement | null, reason = "cancelled") => {
	if (!element) return;

	for (const [scope, active] of activeMotions) {
		if (active.element !== element) continue;
		cancelTileMotion(scope, reason);
	}
};
