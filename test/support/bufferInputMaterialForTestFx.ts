import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import type { RevisionSchema } from "~/item-revision/schema/RevisionSchema";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { discardRuntimeItemIdentityStateFx } from "~/game-runtime/fx/discardRuntimeItemIdentityStateFx";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import { applyInputMaterialStorePlanFx } from "~/production-input/fx/applyInputMaterialStorePlanFx";
import { reconcileOutboundDeliveriesRuntimeFx } from "~/production-delivery/fx/reconcileOutboundDeliveriesRuntimeFx";

export namespace bufferInputMaterialForTestFx {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
		readonly lineId: IdSchema.Type;
		readonly inputIndex: NonNegativeIntegerSchema.Type;
		readonly sourceItemId: IdSchema.Type;
		readonly sourceItemRevision: RevisionSchema.Type;
	}
}

/** Establishes an already admitted material input for tests of downstream behavior. */
export const bufferInputMaterialForTestFx = Effect.fn("bufferInputMaterialForTestFx")(function* ({
	ownerItemId,
	lineId,
	inputIndex,
	sourceItemId,
	sourceItemRevision,
}: bufferInputMaterialForTestFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const source = runtime.items.find((item) => item.id === sourceItemId);
			const owner = runtime.items.find((item) => item.id === ownerItemId);
			if (
				source?.location.scope !== "board" ||
				source.revision !== sourceItemRevision ||
				owner?.location.scope !== "board"
			) {
				return yield* Effect.die(new Error("Invalid buffered-input test setup."));
			}

			const cleared = yield* discardRuntimeItemIdentityStateFx({
				ownerItemIds: new Set([
					sourceItemId,
				]),
				runtime,
			});
			const [{ storedItem }, stored] = yield* applyInputMaterialStorePlanFx({
				location: {
					scope: "input",
					ownerItemId,
					lineId,
					inputIndex,
				},
				runtime: cleared,
				source,
			});
			const nextRuntime = yield* reconcileOutboundDeliveriesRuntimeFx({
				runtime: stored,
			});
			return [
				storedItem,
				nextRuntime,
				[
					{
						type: GameEventEnumSchema.enum.ItemInputStored,
						sourceItemId,
						itemUid: source.item.uid,
						previousSourceLocation: source.location,
						ownerItemId,
						lineId,
						inputIndex,
					} satisfies GameEventSchema.Type,
				],
			] as const;
		}),
	);
});
