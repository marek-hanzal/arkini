import { Effect, Option } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import { applyInputMaterialStorePlanFx } from "~/engine/input/fx/applyInputMaterialStorePlanFx";
import type { planLineInputAutofillFx } from "~/engine/input/fx/planLineInputAutofillFx";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { isGridRuntimeItemFx } from "~/engine/runtime/read/isGridRuntimeItemFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace applyLineInputAutofillPlanFx {
	export interface Props {
		readonly lineId: IdSchema.Type;
		readonly ownerItemId: IdSchema.Type;
		readonly plan: planLineInputAutofillFx.Result;
		readonly runtime: RuntimeSchema.Type;
	}

	export interface Result {
		readonly events: readonly GameEventSchema.Type[];
		readonly runtime: RuntimeSchema.Type;
		readonly storedQuantity: number;
	}
}

/** Applies one snapshot-owned Autofill allocation directly to canonical line-input storage. */
export const applyLineInputAutofillPlanFx = Effect.fn("applyLineInputAutofillPlanFx")(function* ({
	lineId,
	ownerItemId,
	plan,
	runtime,
}: applyLineInputAutofillPlanFx.Props) {
	let draft = runtime;
	const events: GameEventSchema.Type[] = [];
	let storedQuantity = 0;

	for (const entry of plan.entry) {
		const runtimeSource = draft.items.find((item) => {
			return item.id === entry.sourceItemId;
		});
		const source =
			runtimeSource === undefined
				? undefined
				: Option.getOrUndefined(yield* isGridRuntimeItemFx(runtimeSource));
		if (source === undefined) {
			return yield* Effect.die(
				new Error(`Autofill source ${entry.sourceItemId} left its grid before apply.`),
			);
		}
		const [result, nextRuntime] = yield* applyInputMaterialStorePlanFx({
			location: {
				scope: LocationScopeEnumSchema.enum.Input,
				ownerItemId,
				lineId,
				inputIndex: entry.inputIndex,
			},
			plan: {
				sourceItemId: entry.sourceItemId,
				quantity: entry.quantity,
			},
			runtime: draft,
			source,
		});
		draft = nextRuntime;
		storedQuantity += result.storedItem.quantity;
		events.push({
			type: GameEventEnumSchema.enum.ItemInputStored,
			sourceItemId: source.id,
			canonicalItemId: source.item.id,
			previousSourceLocation: source.location,
			previousQuantity: source.quantity,
			storedQuantity: result.storedItem.quantity,
			resultingQuantity: result.sourceItem?.quantity ?? 0,
			ownerItemId,
			lineId,
			inputIndex: entry.inputIndex,
		});
	}

	return {
		events,
		runtime: draft,
		storedQuantity,
	} satisfies applyLineInputAutofillPlanFx.Result;
});
