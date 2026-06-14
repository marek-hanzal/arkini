import { assign, setup } from "xstate";
import type { ActiveSheet, BottomNavSheet } from "~/play/logic/playSheetTypes";
import { blurActiveElement } from "~/shared/util/blurActiveElement";

export namespace playSheetMachine {
	export interface Context {
		renderedSheet: ActiveSheet;
		selectedBoardItemId?: string;
	}

	export type Event =
		| {
				type: "OPEN_SHEET";
				sheet: BottomNavSheet;
		  }
		| {
				type: "OPEN_ITEM";
				boardItemId: string;
		  }
		| {
				type: "CLOSE";
		  };
}

export const playSheetMachine = setup({
	types: {
		context: {} as playSheetMachine.Context,
		events: {} as playSheetMachine.Event,
	},
	actions: {
		blurActiveElement,
		openSheet: assign(({ event }) => {
			if (event.type !== "OPEN_SHEET") return {};

			return {
				renderedSheet: event.sheet,
				selectedBoardItemId: undefined,
			};
		}),
		openItem: assign(({ event }) => {
			if (event.type !== "OPEN_ITEM") return {};

			return {
				renderedSheet: "item" as const,
				selectedBoardItemId: event.boardItemId,
			};
		}),
		clearSelectedItem: assign({
			selectedBoardItemId: undefined,
		}),
	},
	guards: {
		isSameOpenSheet: ({ context, event }) =>
			event.type === "OPEN_SHEET" && context.renderedSheet === event.sheet,
	},
}).createMachine({
	id: "playSheet",
	initial: "closed",
	context: {
		renderedSheet: "inventory",
	},
	states: {
		closed: {
			on: {
				OPEN_SHEET: {
					target: "open",
					actions: [
						"blurActiveElement",
						"openSheet",
					],
				},
				OPEN_ITEM: {
					target: "open",
					actions: [
						"blurActiveElement",
						"openItem",
					],
				},
			},
		},
		open: {
			on: {
				CLOSE: {
					target: "closed",
					actions: [
						"blurActiveElement",
						"clearSelectedItem",
					],
				},
				OPEN_SHEET: [
					{
						guard: "isSameOpenSheet",
						target: "closed",
						actions: [
							"blurActiveElement",
							"clearSelectedItem",
						],
					},
					{
						target: "open",
						actions: [
							"blurActiveElement",
							"openSheet",
						],
					},
				],
				OPEN_ITEM: {
					target: "open",
					actions: [
						"blurActiveElement",
						"openItem",
					],
				},
			},
		},
	},
});
