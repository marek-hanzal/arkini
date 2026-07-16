import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import { readInputRunItemFx } from "~/engine/input/read/readInputRunItemFx";
import type { InputMaterialRunPlanSchema } from "~/engine/input/schema/run/InputMaterialRunPlanSchema";
import type { ReservedLocationSchema } from "~/engine/location/schema/ReservedLocationSchema";
import { createRuntimeItemFx } from "~/engine/runtime/fx/createRuntimeItemFx";
import { createRuntimeItemIdFx } from "~/engine/runtime/fx/createRuntimeItemIdFx";
import { reviseRuntimeItemFx } from "~/engine/runtime/fx/reviseRuntimeItemFx";
import type { InputRuntimeItemSchema } from "~/engine/runtime/schema/InputRuntimeItemSchema";
import type { ReservedRuntimeItemSchema } from "~/engine/runtime/schema/ReservedRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace applyInputMaterialReserveRunPlanFx {
	export interface Props {
		jobId: IdSchema.Type;
		ownerItemId: IdSchema.Type;
		lineId: IdSchema.Type;
		inputIndex: NonNegativeIntegerSchema.Type;
		plan: InputMaterialRunPlanSchema.Type;
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
		return yield* Effect.reduce(plan.item, runtime, (draft, allocation) => {
			return Effect.gen(function* () {
				const item = yield* readInputRunItemFx({
					ownerItemId,
					lineId,
					inputIndex,
					itemId: allocation.itemId,
					plannedQuantity: allocation.quantity,
					runtime: draft,
				});
				const location = {
					scope: "reserved",
					jobId,
				} satisfies ReservedLocationSchema.Type;

				if (allocation.quantity === item.quantity) {
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
				}

				const sourceItem = yield* reviseRuntimeItemFx({
					item: {
						...item,
						quantity: item.quantity - allocation.quantity,
					} satisfies InputRuntimeItemSchema.Type,
				});
				const reservedItem = yield* createRuntimeItemFx({
					id: yield* createRuntimeItemIdFx(),
					item: item.item,
					location,
					quantity: allocation.quantity,
				});

				return {
					...draft,
					items: [
						...draft.items.map((candidate) => {
							return candidate.id === item.id ? sourceItem : candidate;
						}),
						reservedItem,
					],
				} satisfies RuntimeSchema.Type;
			});
		});
	},
);
