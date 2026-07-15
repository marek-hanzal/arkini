import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import { readInputRunItemFx } from "~/v1/input/read/readInputRunItemFx";
import type { InputMaterialRunPlanSchema } from "~/v1/input/schema/run/InputMaterialRunPlanSchema";
import type { JobLocationSchema } from "~/v1/location/schema/JobLocationSchema";
import { createRuntimeItemFx } from "~/v1/runtime/fx/createRuntimeItemFx";
import { createRuntimeItemIdFx } from "~/v1/runtime/fx/createRuntimeItemIdFx";
import { discardRuntimeItemOwnedStateFx } from "~/v1/runtime/fx/discardRuntimeItemOwnedStateFx";
import { reviseRuntimeItemFx } from "~/v1/runtime/fx/reviseRuntimeItemFx";
import type { InputRuntimeItemSchema } from "~/v1/runtime/schema/InputRuntimeItemSchema";
import type { JobRuntimeItemSchema } from "~/v1/runtime/schema/JobRuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace applyInputMaterialConsumeRunPlanFx {
	export interface Props {
		jobId: IdSchema.Type;
		ownerItemId: IdSchema.Type;
		lineId: IdSchema.Type;
		inputIndex: NonNegativeIntegerSchema.Type;
		plan: InputMaterialRunPlanSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Commits exact consume allocations to one job and discards their owned state. */
export const applyInputMaterialConsumeRunPlanFx = Effect.fn("applyInputMaterialConsumeRunPlanFx")(
	function* ({
		jobId,
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
				const location = {
					scope: "job",
					jobId,
				} satisfies JobLocationSchema.Type;

				if (allocation.quantity === item.quantity) {
					const discardedRuntime = yield* discardRuntimeItemOwnedStateFx({
						ownerItemId: item.id,
						runtime: draft,
					});
					const consumedItem = yield* reviseRuntimeItemFx({
						item: {
							...item,
							location,
						} satisfies JobRuntimeItemSchema.Type,
					});
					return {
						...discardedRuntime,
						items: discardedRuntime.items.map((candidate) => {
							return candidate.id === item.id ? consumedItem : candidate;
						}),
					} satisfies RuntimeSchema.Type;
				}

				const sourceItem = yield* reviseRuntimeItemFx({
					item: {
						...item,
						quantity: item.quantity - allocation.quantity,
					} satisfies InputRuntimeItemSchema.Type,
				});
				const consumedItem = yield* createRuntimeItemFx({
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
						consumedItem,
					],
				} satisfies RuntimeSchema.Type;
			});
		});
	},
);
