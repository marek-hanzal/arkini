import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import {
	freezeElementVisualState,
	readTileVisualSnapshot,
	type TileVisualSnapshot,
} from "~/v0/tile-engine/TileVisualSnapshot";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

namespace TileMotionRuntime {
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

	export interface MotionControl {
		readonly finished: Promise<unknown>;
		cancel(): void;
		commitStyles?(): void;
	}

	export interface ActiveMotion {
		readonly id: string;
		readonly scope: string;
		readonly element: HTMLElement;
		readonly control: MotionControl;
		resolve(result: Result): void;
	}
}

const activeMotions = new Map<string, TileMotionRuntime.ActiveMotion>();
let motionSequence = 0;

export const tileMotionScope = (tileId: TileEngine.Id) => `tile:${tileId}`;
export const tilePresenceMotionScope = (tileId: TileEngine.Id) => `tile-presence:${tileId}`;
export const tileFeedbackMotionScope = (tileId: TileEngine.Id) => `tile-feedback:${tileId}`;

const createMotionId = (scope: string) => `motion:${scope}:${++motionSequence}`;

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

const toMilliseconds = (seconds: number) => Math.max(0, seconds * 1000);

const resolveEasing = (ease: readonly number[]) => {
	if (ease.length !== 4) return "ease";
	return `cubic-bezier(${ease[0]}, ${ease[1]}, ${ease[2]}, ${ease[3]})`;
};

const toCssPropertyName = (property: string) =>
	property.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);

const resolveBoundaryKeyframeValue = (
	value: unknown,
	boundary: "first" | "last",
): string | null => {
	const resolvedValue = Array.isArray(value)
		? boundary === "first"
			? value[0]
			: value.at(-1)
		: value;

	if (resolvedValue === null || typeof resolvedValue === "undefined") return null;
	return String(resolvedValue);
};

const applyBoundaryKeyframe = (
	element: HTMLElement,
	keyframes: TileMotionRuntime.StyleKeyframes,
	boundary: "first" | "last",
) => {
	for (const [property, value] of Object.entries(keyframes)) {
		const resolvedValue = resolveBoundaryKeyframeValue(value, boundary);
		if (resolvedValue === null) continue;

		if (property === "opacity") {
			element.style.opacity = resolvedValue;
			continue;
		}

		if (property === "transform") {
			element.style.transform = resolvedValue;
			continue;
		}

		element.style.setProperty(toCssPropertyName(property), resolvedValue);
	}
};

const startFallbackAnimation = ({
	delay,
	duration,
	element,
	keyframes,
}: {
	readonly delay: number;
	readonly duration: number;
	readonly element: HTMLElement;
	readonly keyframes: TileMotionRuntime.StyleKeyframes;
}): TileMotionRuntime.MotionControl => {
	let settled = false;
	let timeout: ReturnType<typeof setTimeout> | null = null;
	let rejectFinished!: (reason?: unknown) => void;
	let resolveFinished!: () => void;
	const finished = new Promise<void>((resolve, reject) => {
		resolveFinished = resolve;
		rejectFinished = reject;
	});

	applyBoundaryKeyframe(element, keyframes, "first");
	timeout = setTimeout(() => {
		if (settled) return;
		settled = true;
		applyBoundaryKeyframe(element, keyframes, "last");
		resolveFinished();
	}, delay + duration);

	return {
		finished,
		cancel: () => {
			if (settled) return;
			settled = true;
			if (timeout) clearTimeout(timeout);
			rejectFinished(new DOMException("Animation cancelled", "AbortError"));
		},
	};
};

const startElementAnimation = ({
	delay,
	duration,
	ease,
	element,
	keyframes,
}: {
	readonly delay: number;
	readonly duration: number;
	readonly ease: readonly number[];
	readonly element: HTMLElement;
	readonly keyframes: TileMotionRuntime.StyleKeyframes;
}): TileMotionRuntime.MotionControl => {
	if (typeof element.animate !== "function") {
		return startFallbackAnimation({
			delay: toMilliseconds(delay),
			duration: toMilliseconds(duration),
			element,
			keyframes,
		});
	}

	const animation = element.animate(keyframes as PropertyIndexedKeyframes, {
		delay: toMilliseconds(delay),
		duration: toMilliseconds(duration),
		easing: resolveEasing(ease),
		fill: "both",
	});

	const commitStyles =
		typeof animation.commitStyles === "function" ? () => animation.commitStyles() : null;

	return {
		finished: animation.finished,
		cancel: () => animation.cancel(),
		...(commitStyles
			? {
					commitStyles,
				}
			: {}),
	};
};

const commitElementVisualState = (
	element: HTMLElement,
	control: TileMotionRuntime.MotionControl,
): TileVisualSnapshot.Type => {
	if (control.commitStyles) {
		try {
			control.commitStyles();
			control.cancel();
			return readTileVisualSnapshot(element);
		} catch {
			// Fall through to the manual computed-style freeze. Browsers and tests get
			// cranky in different ways, because apparently animation cleanup needed lore.
		}
	}

	const snapshot = freezeElementVisualState(element);
	control.cancel();
	return snapshot;
};

export const cancelTileMotion = (
	scope: string,
	reason = "cancelled",
): TileVisualSnapshot.Type | null => {
	const active = activeMotions.get(scope);
	if (!active) return null;

	const snapshot = freezeElementVisualState(active.element);
	activeMotions.delete(scope);
	active.control.cancel();
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
		if (active.element !== element && !element.contains(active.element)) continue;
		cancelTileMotion(scope, reason);
	}
};
