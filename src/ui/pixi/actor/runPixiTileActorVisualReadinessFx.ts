import { Effect } from "effect";

import type {
	PixiTileActorVisual,
	PixiTileActorVisualReadyListener,
} from "~/ui/pixi/actor/PixiTileActorVisual";

export namespace runPixiTileActorVisualReadinessFx {
	export type Action =
		| {
				readonly kind: "begin";
				readonly visual: PixiTileActorVisual;
		  }
		| {
				readonly generation: number;
				readonly kind: "complete";
				readonly visual: PixiTileActorVisual;
		  }
		| {
				readonly generation: number;
				readonly kind: "fail";
				readonly visual: PixiTileActorVisual;
		  }
		| {
				readonly kind: "cancel";
				readonly visual: PixiTileActorVisual;
		  }
		| {
				readonly kind: "when-ready";
				readonly onCancel?: () => void;
				readonly onReady: () => void;
				readonly visual: PixiTileActorVisual;
		  };
}

const invokeListener = (visual: PixiTileActorVisual, callback: () => void) => {
	try {
		callback();
	} catch (cause) {
		visual.reportCriticalFailure(cause);
	}
};

const drainListeners = (
	visual: PixiTileActorVisual,
	select: (listener: PixiTileActorVisualReadyListener) => (() => void) | undefined,
) => {
	const listeners = [
		...visual.readyListeners,
	];
	visual.readyListeners.clear();
	for (const listener of listeners) {
		const callback = select(listener);
		if (callback !== undefined) invokeListener(visual, callback);
	}
};

/** Owns the synchronous readiness state machine for one retained visual revision. */
export const runPixiTileActorVisualReadinessFx = Effect.fnUntraced(function* (
	action: runPixiTileActorVisualReadinessFx.Action,
) {
	return yield* Effect.sync(() => {
		const visual = action.visual;
		switch (action.kind) {
			case "begin": {
				if (visual.textureState === "destroyed") return visual.textureGeneration;
				drainListeners(visual, ({ onCancel }) => onCancel);
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
				drainListeners(visual, ({ onReady }) => onReady);
				return;
			}
			case "fail": {
				if (
					visual.textureState === "destroyed" ||
					visual.textureGeneration !== action.generation
				)
					return;
				visual.textureState = "failed";
				drainListeners(visual, ({ onCancel }) => onCancel);
				return;
			}
			case "cancel": {
				if (visual.textureState === "destroyed") return;
				visual.textureState = "destroyed";
				visual.textureGeneration += 1;
				drainListeners(visual, ({ onCancel }) => onCancel);
				return;
			}
			case "when-ready": {
				if (visual.textureState === "ready") {
					invokeListener(visual, action.onReady);
					return;
				}
				if (visual.textureState === "destroyed" || visual.textureState === "failed") {
					if (action.onCancel !== undefined) invokeListener(visual, action.onCancel);
					return;
				}
				visual.readyListeners.add({
					onCancel: action.onCancel,
					onReady: action.onReady,
				});
			}
		}
	});
});
