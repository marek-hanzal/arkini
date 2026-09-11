import { Effect } from "effect";

import type { BaseSchema } from "~/item-definition/schema/BaseSchema";

export interface BoardLayerControl {
	readonly readLayerFx: Effect.Effect<BaseSchema.Type["layer"]>;
	readonly setLayerFx: (layer: BaseSchema.Type["layer"]) => Effect.Effect<void>;
	readonly setGroundHeldFx: (held: boolean) => Effect.Effect<void>;
	readonly subscribeFx: (
		listenerFn: (layer: BaseSchema.Type["layer"]) => void,
	) => Effect.Effect<() => void>;
	readonly closeFx: Effect.Effect<void>;
}

/** Route-local viewing intent; a temporary hold never overwrites another control's selection. */
export const createBoardLayerControlFx = Effect.fn("createBoardLayerControlFx")(() =>
	Effect.sync((): BoardLayerControl => {
		let selectedLayer: BaseSchema.Type["layer"] = "content";
		let layer: BaseSchema.Type["layer"] = "content";
		let groundHeld = false;
		let closed = false;
		const listeners = new Set<(layer: BaseSchema.Type["layer"]) => void>();
		const publishFn = () => {
			const nextLayer = groundHeld ? "ground" : selectedLayer;
			if (layer === nextLayer) return;
			layer = nextLayer;
			for (const listenerFn of listeners) listenerFn(layer);
		};
		return {
			readLayerFx: Effect.sync(() => layer),
			setLayerFx: (nextLayer) =>
				Effect.sync(() => {
					if (closed) return;
					selectedLayer = nextLayer;
					publishFn();
				}),
			setGroundHeldFx: (held) =>
				Effect.sync(() => {
					if (closed) return;
					groundHeld = held;
					publishFn();
				}),
			subscribeFx: (listenerFn) =>
				Effect.sync(() => {
					if (closed) return () => undefined;
					listeners.add(listenerFn);
					return () => listeners.delete(listenerFn);
				}),
			closeFx: Effect.sync(() => {
				closed = true;
				listeners.clear();
			}),
		};
	}),
);
