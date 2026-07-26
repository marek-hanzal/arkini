import { Effect } from "effect";
import { match } from "ts-pattern";

import type {
	PixiTileActorVisual,
	PixiTileActorVisualReadyListener,
} from "~/ui/pixi/actor/PixiTileActorVisual";

const invokeListener = (callback: () => void) => {
	try {
		callback();
	} catch (cause) {
		console.error("Pixi tile visual readiness listener failed.", cause);
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
		if (callback !== undefined) invokeListener(callback);
	}
};

export const beginPixiTileActorVisualTextureLoadFx = Effect.fn(
	"beginPixiTileActorVisualTextureLoadFx",
)((visual: PixiTileActorVisual) =>
	Effect.sync(() => {
		if (visual.textureState === "destroyed") return visual.textureGeneration;
		drainListeners(visual, ({ onCancel }) => onCancel);
		visual.textureState = "loading";
		visual.textureGeneration += 1;
		return visual.textureGeneration;
	}),
);

export const completePixiTileActorVisualTextureLoadFx = Effect.fn(
	"completePixiTileActorVisualTextureLoadFx",
)(({ generation, visual }: { readonly generation: number; readonly visual: PixiTileActorVisual }) =>
	Effect.sync(() => {
		if (visual.textureState === "destroyed" || visual.textureGeneration !== generation) {
			return;
		}
		visual.textureState = "ready";
		drainListeners(visual, ({ onReady }) => onReady);
	}),
);

export const failPixiTileActorVisualTextureLoadFx = Effect.fn(
	"failPixiTileActorVisualTextureLoadFx",
)(({ generation, visual }: { readonly generation: number; readonly visual: PixiTileActorVisual }) =>
	Effect.sync(() => {
		if (visual.textureState === "destroyed" || visual.textureGeneration !== generation) {
			return;
		}
		visual.textureState = "failed";
		drainListeners(visual, ({ onCancel }) => onCancel);
	}),
);

export const whenPixiTileActorVisualReadyFx = Effect.fn("whenPixiTileActorVisualReadyFx")(
	({
		onCancel,
		onReady,
		visual,
	}: {
		readonly onCancel?: () => void;
		readonly onReady: () => void;
		readonly visual: PixiTileActorVisual;
	}) =>
		Effect.sync(() => {
			match(visual.textureState)
				.with("ready", () => {
					invokeListener(onReady);
				})
				.with("destroyed", "failed", () => {
					if (onCancel !== undefined) invokeListener(onCancel);
				})
				.with("loading", () => {
					visual.readyListeners.add({
						onCancel,
						onReady,
					});
				})
				.exhaustive();
		}),
);

export const cancelPixiTileActorVisualReadinessFx = Effect.fn(
	"cancelPixiTileActorVisualReadinessFx",
)((visual: PixiTileActorVisual) =>
	Effect.sync(() => {
		if (visual.textureState === "destroyed") return;
		visual.textureState = "destroyed";
		visual.textureGeneration += 1;
		drainListeners(visual, ({ onCancel }) => onCancel);
	}),
);
