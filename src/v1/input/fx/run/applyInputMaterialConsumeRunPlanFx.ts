import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import { readInputRunItemFx } from "~/v1/input/read/readInputRunItemFx";
import type { InputMaterialRunPlanSchema } from "~/v1/input/schema/run/InputMaterialRunPlanSchema";
import { reviseRuntimeItemFx } from "~/v1/runtime/fx/reviseRuntimeItemFx";
import type { InputRuntimeItemSchema } from "~/v1/runtime/schema/InputRuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace applyInputMaterialConsumeRunPlanFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		lineId: IdSchema.Type;
		inputIndex: NonNegativeIntegerSchema.Type;
		plan: InputMaterialRunPlanSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Applies one exact consume allocation to an immutable runtime draft. */
export const applyInputMaterialConsumeRunPlanFx = Effect.fn("applyInputMaterialConsumeRunPlanFx")(
	function* ({
		ownerItemId,
		lineId,
		inputIndex,
		plan,
		runtime,
	}: applyInputMaterialConsumeRunPlanFx.Props) {
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
				if (allocation.quantity === item.quantity) {
					return {
						...draft,
						items: draft.items.filter((candidate) => candidate.id !== item.id),
					} satisfies RuntimeSchema.Type;
				}

				const updatedItem = yield* reviseRuntimeItemFx({
					item: {
						...item,
						quantity: item.quantity - allocation.quantity,
					} satisfies InputRuntimeItemSchema.Type,
				});

				return {
					...draft,
					items: draft.items.map((candidate) => {
						return candidate.id === item.id ? updatedItem : candidate;
					}),
				} satisfies RuntimeSchema.Type;
			});
		});
	},
);
