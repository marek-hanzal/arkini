import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import { readInputRunItemFx } from "~/production-input/fx/readInputRunItemFx";
import type { InputRun } from "~/production-input/type/InputRun";
import type { ReservedLocationSchema } from "~/item-location/schema/ReservedLocationSchema";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
import type { ReservedRuntimeItemSchema } from "~/game-runtime/schema/ReservedRuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";

export namespace applyInputMaterialReserveRunPlanFx {
	export interface Props {
		jobId: IdSchema.Type;
		ownerItemId: IdSchema.Type;
		lineId: IdSchema.Type;
		inputIndex: NonNegativeIntegerSchema.Type;
		plan: InputRun.MaterialPlan;
		runtime: RuntimeSchema.Type;
	}
}

/** Moves one exact reserve allocation from an input buffer into one active job. */
export const applyInputMaterialReserveRunPlanFx = Effect.fn("applyInputMaterialReserveRunPlanFx")(
	function* ({
		jobId,
		ownerItemId,
		lineId,
		inputIndex,
		plan,
		runtime,
	}: applyInputMaterialReserveRunPlanFx.Props) {
		return yield* Effect.reduce(
			plan.item,
			() => runtime,
			(draft, allocation) => {
				return Effect.gen(function* () {
					const item = yield* readInputRunItemFx({
						ownerItemId,
						lineId,
						inputIndex,
						itemId: allocation.itemId,
						runtime: draft,
					});
					const location = {
						scope: LocationScopeEnumSchema.enum.Reserved,
						jobId,
						inputIndex,
					} satisfies ReservedLocationSchema.Type;

					const reservedItem = yield* reviseRuntimeItemFx({
						item: {
							...item,
							location,
						} satisfies ReservedRuntimeItemSchema.Type,
					});
					return {
						...draft,
						items: draft.items.map((candidate) => {
							return candidate.id === item.id ? reservedItem : candidate;
						}),
					} satisfies RuntimeSchema.Type;
				});
			},
		);
	},
);
