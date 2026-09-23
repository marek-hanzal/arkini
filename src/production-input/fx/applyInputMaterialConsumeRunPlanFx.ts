import { Effect } from "effect";

import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import { readInputRunItemFx } from "~/production-input/fx/readInputRunItemFx";
import type { InputRun } from "~/production-input/type/InputRun";
import type { JobLocationSchema } from "~/item-location/schema/JobLocationSchema";
import { discardRuntimeItemOwnedStateFx } from "~/game-runtime/fx/discardRuntimeItemOwnedStateFx";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
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
}

/** Commits exact consume allocations to one job. */
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
						runtime: state.runtime,
					});
					const location = {
						scope: LocationScopeEnumSchema.enum.Job,
						jobId,
						inputIndex,
					} satisfies JobLocationSchema.Type;

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
						events: [
							...state.events,
							...discardedRuntime.events,
							{
								type: GameEventEnumSchema.enum.ItemConsumed,
								sourceItemId: item.id,
								itemUid: item.item.uid,
								sourceLocation: item.location,
							} satisfies GameEventSchema.Type,
						],
						runtime: {
							...discardedRuntime.runtime,
							items: discardedRuntime.runtime.items.map((candidate) =>
								candidate.id === item.id ? consumedItem : candidate,
							),
						} satisfies RuntimeSchema.Type,
					};
				}),
		);
	},
);
