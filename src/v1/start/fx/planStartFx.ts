import { Effect } from "effect";

import { applyPlacementPlanFx } from "~/v1/placement/fx/applyPlacementPlanFx";
import { mergePlacementPlansFx } from "~/v1/placement/fx/mergePlacementPlansFx";
import type { PlacementPlanSchema } from "~/v1/placement/schema/PlacementPlanSchema";
import { assertRuntimeFx } from "~/v1/runtime/check/assertRuntimeFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import type { StartSchema } from "~/v1/start/schema/StartSchema";
import { planStartBoardItemFx } from "./planStartBoardItemFx";
import { planStartInventoryItemFx } from "./planStartInventoryItemFx";

export namespace planStartFx {
	export interface Props {
		runtime: RuntimeSchema.Type;
		start: StartSchema.Type;
	}
}

interface PlanningState {
	readonly draft: RuntimeSchema.Type;
	readonly plans: PlacementPlanSchema.Type[];
}

/**
 * Plans every initial board and inventory item against one immutable runtime draft.
 */
export const planStartFx = Effect.fn("planStartFx")(function* ({
	runtime,
	start,
}: planStartFx.Props) {
	const initialState: PlanningState = {
		draft: runtime,
		plans: [],
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
				plans: [
					...state.plans,
					plan,
				],
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
				plans: [
					...state.plans,
					plan,
				],
			} satisfies PlanningState;
		});
	});

	yield* assertRuntimeFx({
		runtime: inventory.draft,
	});

	return yield* mergePlacementPlansFx({
		plans: inventory.plans,
	});
});
