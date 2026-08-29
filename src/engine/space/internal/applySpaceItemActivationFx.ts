import { Effect, Option } from "effect";

import { settleActionChargesFx } from "~/engine/action/fx/settleActionChargesFx";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import { ItemNotOnGridError } from "~/engine/item/error/ItemNotOnGridError";
import { isSameGridLocationFn } from "~/engine/location/fn/isSameGridLocationFn";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { ItemLocationConflictError } from "~/engine/runtime/error/ItemLocationConflictError";
import { isGridRuntimeItemFn } from "~/engine/runtime/read/fn/isGridRuntimeItemFn";
import { readValidatedRuntimeItemFx } from "~/engine/runtime/read/readValidatedRuntimeItemFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { CurrentSpaceConflictError } from "~/engine/space/error/CurrentSpaceConflictError";
import { setCurrentSpaceRuntimeFx } from "~/engine/space/internal/setCurrentSpaceRuntimeFx";
import { resolveSpaceActionFx } from "~/engine/space/read/resolveSpaceActionFx";

export namespace applySpaceItemActivationFx {
	export interface Props {
		readonly runtime: RuntimeSchema.Type;
		readonly currentSpace: NonNegativeIntegerSchema.Type;
		readonly itemId: IdSchema.Type;
		readonly location: GridLocationSchema.Type;
		readonly revision: RevisionSchema.Type;
	}
}

/** Applies the shared authoritative transaction body for one Space activation. */
export const applySpaceItemActivationFx = Effect.fn("applySpaceItemActivationFx")(function* ({
	runtime,
	currentSpace,
	itemId,
	location,
	revision,
}: applySpaceItemActivationFx.Props) {
	if (runtime.currentSpace !== currentSpace) {
		return yield* Effect.fail(
			new CurrentSpaceConflictError({
				actualSpace: runtime.currentSpace,
				expectedSpace: currentSpace,
			}),
		);
	}
	const runtimeItem = yield* readValidatedRuntimeItemFx({
		itemId,
		revision,
		runtime,
	});
	const item = Option.getOrUndefined(isGridRuntimeItemFn(runtimeItem));
	if (item === undefined) {
		return yield* Effect.fail(
			new ItemNotOnGridError({
				itemId,
				location: runtimeItem.location,
			}),
		);
	}
	if (
		!isSameGridLocationFn({
			left: item.location,
			right: location,
		})
	) {
		return yield* Effect.fail(
			new ItemLocationConflictError({
				itemId,
				expectedLocation: location,
				actualLocation: item.location,
			}),
		);
	}

	const plan = yield* resolveSpaceActionFx({
		itemId,
		runtime,
	});
	const settlement = yield* settleActionChargesFx({
		actionId: item.item.id,
		charges: plan.charges,
		ownerItemId: plan.ownerItemId,
		runtime,
	});
	const navigation = yield* setCurrentSpaceRuntimeFx({
		runtime: settlement.runtime,
		space: plan.space,
	});
	return [
		plan.space,
		navigation.runtime,
		[
			...settlement.events,
			...navigation.events,
		],
	] as const;
});
