import { Effect } from "effect";

import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

import { createEditorItemSimulatorFx } from "~/editor/simulator/createEditorItemSimulatorFx";

/** Simulates whether and how one item can be produced from the authored editor start state. */
export const simulateEditorItemFx = Effect.fn("simulateEditorItemFx")(
	(config: GameConfigSchema.Type, itemId: string, quantity = 1) =>
		Effect.gen(function* () {
			const simulator = yield* createEditorItemSimulatorFx(config);
			return yield* simulator.simulateFx(itemId, quantity);
		}),
);
