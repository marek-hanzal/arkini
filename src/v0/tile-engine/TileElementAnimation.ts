import {
	freezeElementVisualState,
	readTileVisualSnapshot,
	type TileVisualSnapshot,
} from "~/tile-engine/TileVisualSnapshot";
import type { TileMotionRuntime } from "~/tile-engine/TileMotionRuntimeTypes";

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

export const startElementAnimation = ({
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

export const commitElementVisualState = (
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
