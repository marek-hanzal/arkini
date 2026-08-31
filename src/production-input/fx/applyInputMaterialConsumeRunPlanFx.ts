import { Effect } from "effect";

import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/game-config/schema/NonNegativeIntegerSchema";
import { readInputRunItemFx } from "~/production-input/fx/readInputRunItemFx";
import type { InputRun } from "~/production-input/type/InputRun";
import type { JobLocationSchema } from "~/item-location/schema/JobLocationSchema";
import { createRuntimeItemFx } from "~/game-runtime/fx/createRuntimeItemFx";
import { createRuntimeItemIdFx } from "~/game-runtime/fx/createRuntimeItemIdFx";
import { discardRuntimeItemOwnedStateFx } from "~/game-runtime/fx/discardRuntimeItemOwnedStateFx";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
import type { InputRuntimeItemSchema } from "~/game-runtime/schema/InputRuntimeItemSchema";
import type { JobRuntimeItemSchema } from "~/game-runtime/schema/JobRuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";

export namespace applyInputMaterialConsumeRunPlanFx {
	export interface Props {
		jobId: IdSchema.Type;
		ownerItemId: IdSchema.Type;
		lineId: IdSchema.Type;
		inputIndex: NonNegativeIntegerSchema.Type;
		plan: InputRun.MaterialPlan;
		runtime: RuntimeSchema.Type;
	}

	export interface Consumption {
		readonly sourceItem: InputRuntimeItemSchema.Type;
		readonly consumedItem: JobRuntimeItemSchema.Type;
		readonly remainingQuantity: NonNegativeIntegerSchema.Type;
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
			() => ({
				consumption: [] as applyInputMaterialConsumeRunPlanFx.Consumption[],
				events: [] as GameEventSchema.Type[],
				runtime,
			}),
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
						scope: LocationScopeEnumSchema.enum.Job,
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
							events: [
								...state.events,
								{
									type: GameEventEnumSchema.enum.ItemConsumed,
									sourceItemId: item.id,
									canonicalItemId: item.item.id,
									sourceLocation: item.location,
									previousQuantity: item.quantity,
									consumedQuantity: consumedItem.quantity,
									resultingQuantity: 0,
								} satisfies GameEventSchema.Type,
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
						events: [
							...state.events,
							{
								type: GameEventEnumSchema.enum.ItemConsumed,
								sourceItemId: item.id,
								canonicalItemId: item.item.id,
								sourceLocation: item.location,
								previousQuantity: item.quantity,
								consumedQuantity: consumedItem.quantity,
								resultingQuantity: sourceItem.quantity,
							} satisfies GameEventSchema.Type,
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
