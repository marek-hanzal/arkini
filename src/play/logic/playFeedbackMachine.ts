import { assign, fromPromise, setup } from "xstate";
import { flashMs } from "~/play/types";

const mergePulseMs = 560;
const imprintPulseMs = 640;

interface PlayFeedbackContext {
	invalidBoardCellKey?: string;
	mergedBoardCellKey?: string;
	imprintedBoardCellKey?: string;
	invalidInventorySlot?: number;
	pendingMergedBoardCellKey?: string;
	pendingImprintedBoardCellKey?: string;
}

type PlayFeedbackEvent =
	| {
			type: "FLASH_BOARD_CELL";
			key: string;
	  }
	| {
			type: "PULSE_MERGE_CELL";
			key: string;
	  }
	| {
			type: "PULSE_IMPRINT_CELL";
			key: string;
	  }
	| {
			type: "FLASH_INVENTORY_SLOT";
			slotIndex: number;
	  };

export const playFeedbackMachine = setup({
	types: {
		context: {} as PlayFeedbackContext,
		events: {} as PlayFeedbackEvent,
	},
	actors: {
		waitForAnimationFrame: fromPromise(() => waitForAnimationFrame()),
	},
	actions: {
		setInvalidBoardCell: assign(({ event }) => {
			if (event.type !== "FLASH_BOARD_CELL") return {};
			return {
				invalidBoardCellKey: event.key,
			};
		}),
		clearInvalidBoardCell: assign({
			invalidBoardCellKey: undefined,
		}),
		prepareMergePulse: assign(({ event }) => {
			if (event.type !== "PULSE_MERGE_CELL") return {};
			return {
				mergedBoardCellKey: undefined,
				pendingMergedBoardCellKey: event.key,
			};
		}),
		showMergePulse: assign(({ context }) => ({
			mergedBoardCellKey: context.pendingMergedBoardCellKey,
			pendingMergedBoardCellKey: undefined,
		})),
		clearMergePulse: assign({
			mergedBoardCellKey: undefined,
		}),
		prepareImprintPulse: assign(({ event }) => {
			if (event.type !== "PULSE_IMPRINT_CELL") return {};
			return {
				imprintedBoardCellKey: undefined,
				pendingImprintedBoardCellKey: event.key,
			};
		}),
		showImprintPulse: assign(({ context }) => ({
			imprintedBoardCellKey: context.pendingImprintedBoardCellKey,
			pendingImprintedBoardCellKey: undefined,
		})),
		clearImprintPulse: assign({
			imprintedBoardCellKey: undefined,
		}),
		setInvalidInventorySlot: assign(({ event }) => {
			if (event.type !== "FLASH_INVENTORY_SLOT") return {};
			return {
				invalidInventorySlot: event.slotIndex,
			};
		}),
		clearInvalidInventorySlot: assign({
			invalidInventorySlot: undefined,
		}),
	},
}).createMachine({
	id: "playFeedback",
	type: "parallel",
	context: {},
	states: {
		boardError: {
			initial: "idle",
			states: {
				idle: {
					on: {
						FLASH_BOARD_CELL: {
							target: "active",
							actions: "setInvalidBoardCell",
						},
					},
				},
				active: {
					after: {
						[flashMs]: {
							target: "idle",
							actions: "clearInvalidBoardCell",
						},
					},
					on: {
						FLASH_BOARD_CELL: {
							target: "active",
							reenter: true,
							actions: "setInvalidBoardCell",
						},
					},
				},
			},
		},
		mergePulse: {
			initial: "idle",
			states: {
				idle: {
					on: {
						PULSE_MERGE_CELL: {
							target: "arming",
							actions: "prepareMergePulse",
						},
					},
				},
				arming: {
					invoke: {
						src: "waitForAnimationFrame",
						onDone: {
							target: "active",
							actions: "showMergePulse",
						},
					},
					on: {
						PULSE_MERGE_CELL: {
							target: "arming",
							reenter: true,
							actions: "prepareMergePulse",
						},
					},
				},
				active: {
					after: {
						[mergePulseMs]: {
							target: "idle",
							actions: "clearMergePulse",
						},
					},
					on: {
						PULSE_MERGE_CELL: {
							target: "arming",
							actions: "prepareMergePulse",
						},
					},
				},
			},
		},
		imprintPulse: {
			initial: "idle",
			states: {
				idle: {
					on: {
						PULSE_IMPRINT_CELL: {
							target: "arming",
							actions: "prepareImprintPulse",
						},
					},
				},
				arming: {
					invoke: {
						src: "waitForAnimationFrame",
						onDone: {
							target: "active",
							actions: "showImprintPulse",
						},
					},
					on: {
						PULSE_IMPRINT_CELL: {
							target: "arming",
							reenter: true,
							actions: "prepareImprintPulse",
						},
					},
				},
				active: {
					after: {
						[imprintPulseMs]: {
							target: "idle",
							actions: "clearImprintPulse",
						},
					},
					on: {
						PULSE_IMPRINT_CELL: {
							target: "arming",
							actions: "prepareImprintPulse",
						},
					},
				},
			},
		},
		inventoryError: {
			initial: "idle",
			states: {
				idle: {
					on: {
						FLASH_INVENTORY_SLOT: {
							target: "active",
							actions: "setInvalidInventorySlot",
						},
					},
				},
				active: {
					after: {
						[flashMs]: {
							target: "idle",
							actions: "clearInvalidInventorySlot",
						},
					},
					on: {
						FLASH_INVENTORY_SLOT: {
							target: "active",
							reenter: true,
							actions: "setInvalidInventorySlot",
						},
					},
				},
			},
		},
	},
});

function waitForAnimationFrame() {
	return new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}
