import { Effect } from "effect";

import type {
	CloseInventoryProps,
	InventoryState,
	OpenInventoryProps,
} from "~/ui/inventory/InventoryControl";

export interface InventoryController {
	readonly getSnapshot: () => InventoryState;
	readonly subscribe: (listener: () => void) => () => void;
	readonly openFx: (props?: OpenInventoryProps) => Effect.Effect<boolean>;
	readonly closeFx: (props?: CloseInventoryProps) => Effect.Effect<boolean>;
	readonly takeRestoreOriginFx: Effect.Effect<HTMLElement | null>;
	readonly resetFx: Effect.Effect<void>;
}

const closedState = {
	phase: "closed",
} as const satisfies InventoryState;

/** Creates one synchronous owner for Inventory state and deferred focus restoration. */
export const createInventoryControllerFx = Effect.fn("createInventoryControllerFx")(() =>
	Effect.sync((): InventoryController => {
		const listeners = new Set<() => void>();
		let snapshot: InventoryState = closedState;
		let restoreOrigin: HTMLElement | null = null;

		const publish = (next: InventoryState) => {
			snapshot = next;
			for (const listener of Array.from(listeners)) listener();
		};

		return {
			getSnapshot: () => snapshot,
			subscribe: (listener) => {
				listeners.add(listener);
				return () => listeners.delete(listener);
			},
			openFx: ({ origin = null }: OpenInventoryProps = {}) =>
				Effect.sync(() => {
					if (snapshot.phase === "open") return false;
					restoreOrigin = null;
					publish({
						phase: "open",
						origin,
					});
					return true;
				}),
			closeFx: ({ restoreFocus = true }: CloseInventoryProps = {}) =>
				Effect.sync(() => {
					if (snapshot.phase === "closed") return false;
					restoreOrigin = restoreFocus ? snapshot.origin : null;
					publish(closedState);
					return true;
				}),
			takeRestoreOriginFx: Effect.sync(() => {
				const origin = restoreOrigin;
				restoreOrigin = null;
				return origin;
			}),
			resetFx: Effect.sync(() => {
				snapshot = closedState;
				restoreOrigin = null;
			}),
		};
	}),
);
