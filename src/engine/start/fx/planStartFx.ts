import { Effect } from "effect";

import { applyPlacementPlanFx } from "~/engine/placement/fx/applyPlacementPlanFx";
import { assertRuntimeFx } from "~/engine/runtime/check/assertRuntimeFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { StartSchema } from "~/engine/start/schema/StartSchema";
import { planStartBoardItemFx } from "./planStartBoardItemFx";
import { planStartInventoryItemFx } from "./planStartInventoryItemFx";
import { planStartToolbarItemFx } from "./planStartToolbarItemFx";

export namespace planStartFx {
	export interface Props {
		runtime: RuntimeSchema.Type;
		start: StartSchema.Type;
	}
}

interface PlanningState {
	readonly draft: RuntimeSchema.Type;
}

/**
 * Builds the exact initial runtime by applying every start entry sequentially.
 */
export const planStartFx = Effect.fn("planStartFx")(function* ({
	runtime,
	start,
}: planStartFx.Props) {
	const initialState: PlanningState = {
		draft: {
			...runtime,
			currentSpace: start.currentSpace,
		},
	};
	const board = yield* Effect.reduce(start.board, initialState, (state, item) => {
		return Effect.gen(function* () {
			const plan = yield* planStartBoardItemFx({
				item,
			});
			const [, draft] = yield* applyPlacementPlanFx({
				plan,
				runtime: state.draft,
			});

			return {
				draft,
			} satisfies PlanningState;
		});
	});
	const inventory = yield* Effect.reduce(start.inventory, board, (state, item) => {
		return Effect.gen(function* () {
			const plan = yield* planStartInventoryItemFx({
				item,
				runtime: state.draft,
			});
			const [, draft] = yield* applyPlacementPlanFx({
				plan,
				runtime: state.draft,
			});

			return {
				draft,
			} satisfies PlanningState;
		});
	});
	const toolbar = yield* Effect.reduce(start.toolbar, inventory, (state, item) => {
		return Effect.gen(function* () {
			const plan = yield* planStartToolbarItemFx({
				item,
			});
			const [, draft] = yield* applyPlacementPlanFx({
				plan,
				runtime: state.draft,
			});

			return {
				draft,
			} satisfies PlanningState;
		});
	});

	yield* assertRuntimeFx({
		runtime: toolbar.draft,
	});

	return toolbar.draft;
});
