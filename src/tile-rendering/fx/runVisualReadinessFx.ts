import { Effect } from "effect";

import type { ActorVisual, VisualReadyListener } from "~/tile-rendering/type/ActorVisual";

export namespace runVisualReadinessFx {
	export type Action =
		| {
				readonly kind: "begin";
				readonly visual: ActorVisual;
		  }
		| {
				readonly generation: number;
				readonly kind: "complete";
				readonly visual: ActorVisual;
		  }
		| {
				readonly generation: number;
				readonly kind: "fail";
				readonly visual: ActorVisual;
		  }
		| {
				readonly kind: "cancel";
				readonly visual: ActorVisual;
		  }
		| {
				readonly kind: "when-ready";
				readonly onCancelFn?: () => void;
				readonly onReadyFn: () => void;
				readonly visual: ActorVisual;
		  };
}

const invokeListenerFn = (visual: ActorVisual, callbackFn: () => void) => {
	try {
		callbackFn();
	} catch (cause) {
		visual.reportCriticalFailureFn(cause);
	}
};

const drainListenersFn = (
	visual: ActorVisual,
	selectFn: (listener: VisualReadyListener) => (() => void) | undefined,
) => {
	const listeners = [
		...visual.readyListeners,
	];
	visual.readyListeners.clear();
	for (const listener of listeners) {
		const callbackFn = selectFn(listener);
		if (callbackFn !== undefined) invokeListenerFn(visual, callbackFn);
	}
};

/** Owns the synchronous readiness state machine for one retained visual revision. */
export const runVisualReadinessFx = Effect.fnUntraced(function* (
	action: runVisualReadinessFx.Action,
) {
	return yield* Effect.sync(() => {
		const visual = action.visual;
		switch (action.kind) {
			case "begin": {
				if (visual.textureState === "destroyed") return visual.textureGeneration;
				drainListenersFn(visual, ({ onCancelFn }) => onCancelFn);
				visual.textureState = "loading";
				visual.textureGeneration += 1;
				return visual.textureGeneration;
			}
			case "complete": {
				if (
					visual.textureState === "destroyed" ||
					visual.textureGeneration !== action.generation
				)
					return;
				visual.textureState = "ready";
				drainListenersFn(visual, ({ onReadyFn }) => onReadyFn);
				return;
			}
			case "fail": {
				if (
					visual.textureState === "destroyed" ||
					visual.textureGeneration !== action.generation
				)
					return;
				visual.textureState = "failed";
				drainListenersFn(visual, ({ onCancelFn }) => onCancelFn);
				return;
			}
			case "cancel": {
				if (visual.textureState === "destroyed") return;
				visual.textureState = "destroyed";
				visual.textureGeneration += 1;
				drainListenersFn(visual, ({ onCancelFn }) => onCancelFn);
				return;
			}
			case "when-ready": {
				if (visual.textureState === "ready") {
					invokeListenerFn(visual, action.onReadyFn);
					return;
				}
				if (visual.textureState === "destroyed" || visual.textureState === "failed") {
					if (action.onCancelFn !== undefined)
						invokeListenerFn(visual, action.onCancelFn);
					return;
				}
				visual.readyListeners.add({
					onCancelFn: action.onCancelFn,
					onReadyFn: action.onReadyFn,
				});
			}
		}
	});
});
