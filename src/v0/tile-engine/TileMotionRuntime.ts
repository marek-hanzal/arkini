import { freezeElementVisualState, readTileVisualSnapshot } from "~/tile-engine/TileVisualSnapshot";
import {
	commitElementVisualState,
	startElementAnimation,
} from "~/tile-engine/TileElementAnimation";
import {
	tileFeedbackMotionScope,
	tileMotionScope,
	tilePresenceMotionScope,
} from "~/tile-engine/TileMotionScopes";
import type { TileMotionRuntime } from "~/tile-engine/TileMotionRuntimeTypes";
import { resolveTileMotionKeyframes, resolveTileMotionValue } from "~/tile-engine/TileMotionValues";

export { tileFeedbackMotionScope, tileMotionScope, tilePresenceMotionScope };
export type { TileMotionRuntime } from "~/tile-engine/TileMotionRuntimeTypes";

const activeMotions = new Map<string, TileMotionRuntime.ActiveMotion>();
let motionSequence = 0;

const createMotionId = (scope: string) => `motion:${scope}:${++motionSequence}`;

export const cancelTileMotion = (scope: string) => {
	const active = activeMotions.get(scope);
	if (!active) return null;

	const snapshot = freezeElementVisualState(active.element);
	activeMotions.delete(scope);
	active.control.cancel();
	active.resolve({
		status: "cancelled",
		snapshot,
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
}: TileMotionRuntime.StartStyleProps): Promise<TileMotionRuntime.Result> => {
	cancelTileMotion(scope);
	const snapshot = readTileVisualSnapshot(element);
	const resolvedKeyframes = resolveTileMotionKeyframes(keyframes, snapshot);
	const motionId = createMotionId(scope);

	let resolveResult!: (result: TileMotionRuntime.Result) => void;
	const result = new Promise<TileMotionRuntime.Result>((resolve) => {
		resolveResult = resolve;
	});

	const control = startElementAnimation({
		delay,
		duration,
		ease,
		element,
		keyframes: resolvedKeyframes,
	});

	const active: TileMotionRuntime.ActiveMotion = {
		id: motionId,
		scope,
		element,
		control,
		resolve: resolveResult,
	};
	activeMotions.set(scope, active);

	void control.finished
		.then(() => {
			if (activeMotions.get(scope)?.id !== motionId) return;
			activeMotions.delete(scope);
			const finalSnapshot = commitElementVisualState(element, control);
			resolveResult({
				status: "completed",
				snapshot: finalSnapshot,
			});
		})
		.catch(() => {
			if (activeMotions.get(scope)?.id !== motionId) return;
			const cancelledSnapshot = freezeElementVisualState(element);
			activeMotions.delete(scope);
			resolveResult({
				status: "cancelled",
				snapshot: cancelledSnapshot,
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
}: TileMotionRuntime.StartTransformProps): Promise<TileMotionRuntime.Result> =>
	startTileStyleMotion({
		scope,
		element,
		keyframes: (snapshot) => ({
			transform: [
				resolveTileMotionValue(from, snapshot),
				resolveTileMotionValue(to, snapshot),
			],
		}),
		duration,
		ease,
	});

export const cancelTileMotionForElement = (element: HTMLElement | null) => {
	if (!element) return;

	for (const [scope, active] of activeMotions) {
		if (active.element !== element && !element.contains(active.element)) continue;
		cancelTileMotion(scope);
	}
};
