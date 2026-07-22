import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import { readInputRunItemFx } from "~/engine/input/read/readInputRunItemFx";
import type { InputMaterialRunPlanSchema } from "~/engine/input/schema/run/InputMaterialRunPlanSchema";
import type { JobLocationSchema } from "~/engine/location/schema/JobLocationSchema";
import { createRuntimeItemFx } from "~/engine/runtime/fx/createRuntimeItemFx";
import { createRuntimeItemIdFx } from "~/engine/runtime/fx/createRuntimeItemIdFx";
import { discardRuntimeItemOwnedStateFx } from "~/engine/runtime/fx/discardRuntimeItemOwnedStateFx";
import { reviseRuntimeItemFx } from "~/engine/runtime/fx/reviseRuntimeItemFx";
import type { InputRuntimeItemSchema } from "~/engine/runtime/schema/InputRuntimeItemSchema";
import type { JobRuntimeItemSchema } from "~/engine/runtime/schema/JobRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace applyInputMaterialConsumeRunPlanFx {
	export interface Props {
		jobId: IdSchema.Type;
		ownerItemId: IdSchema.Type;
		lineId: IdSchema.Type;
		inputIndex: NonNegativeIntegerSchema.Type;
		plan: InputMaterialRunPlanSchema.Type;
		runtime: RuntimeSchema.Type;
	}

	export interface Consumption {
		readonly sourceItem: InputRuntimeItemSchema.Type;
		readonly consumedItem: JobRuntimeItemSchema.Type;
		readonly remainingQuantity: NonNegativeIntegerSchema.Type;
	}

	export interface Result {
		readonly consumption: readonly Consumption[];
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Commits exact consume allocations to one job and returns their source-to-job identities. */
export const applyInputMaterialConsumeRunPlanFx = Effect.fn("applyInputMaterialConsumeRunPlanFx")(
	function* ({
		jobId,
		ownerItemId,
		lineId,
		inputIndex,
		plan,
		runtime,
	}: applyInputMaterialConsumeRunPlanFx.Props) {
		return yield* Effect.reduce(
			plan.item,
			{
				consumption: [] as applyInputMaterialConsumeRunPlanFx.Consumption[],
				runtime,
			},
			(state, allocation) =>
				Effect.gen(function* () {
					const item = yield* readInputRunItemFx({
						ownerItemId,
						lineId,
						inputIndex,
						itemId: allocation.itemId,
						plannedQuantity: allocation.quantity,
						runtime: state.runtime,
					});
					const location = {
						scope: "job",
						jobId,
					} satisfies JobLocationSchema.Type;

					if (allocation.quantity === item.quantity) {
						const discardedRuntime = yield* discardRuntimeItemOwnedStateFx({
							ownerItemId: item.id,
							runtime: state.runtime,
						});
						const consumedItem = yield* reviseRuntimeItemFx({
							item: {
								...item,
								location,
							} satisfies JobRuntimeItemSchema.Type,
						});
						return {
							consumption: [
								...state.consumption,
								{
									sourceItem: item,
									consumedItem,
									remainingQuantity: 0,
								},
							],
							runtime: {
								...discardedRuntime,
								items: discardedRuntime.items.map((candidate) =>
									candidate.id === item.id ? consumedItem : candidate,
								),
							} satisfies RuntimeSchema.Type,
						};
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
						consumption: [
							...state.consumption,
							{
								sourceItem: item,
								consumedItem,
								remainingQuantity: sourceItem.quantity,
							},
						],
						runtime: {
							...state.runtime,
							items: [
								...state.runtime.items.map((candidate) =>
									candidate.id === item.id ? sourceItem : candidate,
								),
								consumedItem,
							],
						} satisfies RuntimeSchema.Type,
					};
				}),
		);
	},
);
