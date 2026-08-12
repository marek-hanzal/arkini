import { Effect } from "effect";

import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

import { createEngineBackedEditorItemSimulatorFx } from "~/editor/simulator/createEngineBackedEditorItemSimulatorFx";

/** Simulates whether and how one item can be produced from the authored editor start state. */
export const simulateEditorItemFx = Effect.fn("simulateEditorItemFx")(
	(config: GameConfigSchema.Type, itemId: string, quantity = 1) =>
		Effect.gen(function* () {
			const simulator = yield* createEngineBackedEditorItemSimulatorFx(config);
			return yield* simulator.simulateFx(itemId, quantity);
		}),
);
