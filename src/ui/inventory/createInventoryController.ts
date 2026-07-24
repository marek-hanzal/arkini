import type {
	CloseInventoryProps,
	InventoryState,
	OpenInventoryProps,
} from "~/ui/inventory/InventoryControl";

export interface InventoryController {
	readonly getSnapshot: () => InventoryState;
	readonly subscribe: (listener: () => void) => () => void;
	readonly open: (props?: OpenInventoryProps) => boolean;
	readonly close: (props?: CloseInventoryProps) => boolean;
	readonly takeRestoreOrigin: () => HTMLElement | null;
	readonly reset: () => void;
}

const closedState = {
	phase: "closed",
} as const satisfies InventoryState;

/** Creates one synchronous owner for Inventory state and deferred focus restoration. */
export const createInventoryController = (): InventoryController => {
	const listeners = new Set<() => void>();
	let snapshot: InventoryState = closedState;
	let restoreOrigin: HTMLElement | null = null;

	const publish = (next: InventoryState) => {
		snapshot = next;
		for (const listener of Array.from(listeners)) listener();
	};

	const open = ({ origin = null }: OpenInventoryProps = {}) => {
		if (snapshot.phase === "open") return false;
		restoreOrigin = null;
		publish({
			phase: "open",
			origin,
		});
		return true;
	};

	const close = ({ restoreFocus = true }: CloseInventoryProps = {}) => {
		if (snapshot.phase === "closed") return false;
		restoreOrigin = restoreFocus ? snapshot.origin : null;
		publish(closedState);
		return true;
	};

	return {
		getSnapshot: () => snapshot,
		subscribe: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		open,
		close,
		takeRestoreOrigin: () => {
			const origin = restoreOrigin;
			restoreOrigin = null;
			return origin;
		},
		reset: () => {
			snapshot = closedState;
			restoreOrigin = null;
		},
	};
};
