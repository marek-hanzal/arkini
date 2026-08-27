import { Effect, Option } from "effect";

import { settleActionChargesFx } from "~/engine/action/fx/settleActionChargesFx";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import { ItemNotOnGridError } from "~/engine/item/error/ItemNotOnGridError";
import { isSameGridLocationFx } from "~/engine/location/read/isSameGridLocationFx";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { ItemLocationConflictError } from "~/engine/runtime/error/ItemLocationConflictError";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { isGridRuntimeItemFx } from "~/engine/runtime/read/isGridRuntimeItemFx";
import { readValidatedRuntimeItemFx } from "~/engine/runtime/read/readValidatedRuntimeItemFx";
import { CurrentSpaceConflictError } from "~/engine/space/error/CurrentSpaceConflictError";
import { setCurrentSpaceRuntimeFx } from "~/engine/space/internal/setCurrentSpaceRuntimeFx";
import { resolveSpaceActionFx } from "~/engine/space/read/resolveSpaceActionFx";

export namespace activateSpaceItemFx {
	export interface Props {
		currentSpace: NonNegativeIntegerSchema.Type;
		itemId: IdSchema.Type;
		location: GridLocationSchema.Type;
		revision: RevisionSchema.Type;
	}
}

/** Settles one fresh Space action plan and navigation in one engine transaction. */
export const activateSpaceItemFx = Effect.fn("activateSpaceItemFx")(function* ({
	currentSpace,
	itemId,
	location,
	revision,
}: activateSpaceItemFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
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
			const item = Option.getOrUndefined(yield* isGridRuntimeItemFx(runtimeItem));
			if (item === undefined) {
				return yield* Effect.fail(
					new ItemNotOnGridError({
						itemId,
						location: runtimeItem.location,
					}),
				);
			}
			if (
				!(yield* isSameGridLocationFx({
					left: item.location,
					right: location,
				}))
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
		}),
	);
});
