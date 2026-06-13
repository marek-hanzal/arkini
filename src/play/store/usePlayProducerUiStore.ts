import { create } from "zustand";

export namespace usePlayProducerUiStore {
	export interface State {
		busyProducerIds: Set<string>;
		setProducerBusy(boardItemId: string, busy: boolean): void;
		clearBusyProducers(): void;
	}
}

export const usePlayProducerUiStore = create<usePlayProducerUiStore.State>((set) => ({
	busyProducerIds: new Set<string>(),
	setProducerBusy(boardItemId, busy) {
		set((state) => {
			const next = new Set(state.busyProducerIds);
			if (busy) next.add(boardItemId);
			else next.delete(boardItemId);
			return {
				busyProducerIds: next,
			};
		});
	},
	clearBusyProducers() {
		set({
			busyProducerIds: new Set<string>(),
		});
	},
}));
