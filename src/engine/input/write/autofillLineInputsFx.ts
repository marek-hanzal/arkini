import { Effect, Option } from "effect";
import { match, P } from "ts-pattern";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { planLineInputAutofillFx } from "~/engine/input/fx/planLineInputAutofillFx";
import { isGridRuntimeItemFx } from "~/engine/runtime/read/isGridRuntimeItemFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import { DropItemRejectedReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemRejectedReasonEnumSchema";
import { DropItemResultKindEnumSchema } from "~/engine/runtime/schema/command/DropItemResultKindEnumSchema";
import { dropItemFx } from "~/engine/runtime/write/dropItemFx";

export namespace autofillLineInputsFx {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
		readonly lineId: IdSchema.Type;
	}

	export interface Result {
		readonly storedQuantity: number;
		readonly remainingMissingQuantity: number;
	}
}

const maxConsecutiveDropConflicts = 16;

/**
 * Fills one line from its owner's board and Inventory through ordinary item-drop commands.
 *
 * Each planned source presents its complete current stack, while the command requests only the
 * exact missing quantity for one slot. The canonical drop path rechecks that request against current
 * capacity, publishes one normal committed transition, and leaves any remainder at its origin.
 * A concurrent canonical command may invalidate the optimistic source or owner revision between
 * planning and drop; those expected conflicts reload runtime truth and replan instead of pretending
 * that no autofill source exists.
 */
export const autofillLineInputsFx = Effect.fn("autofillLineInputsFx")(function* ({
	ownerItemId,
	lineId,
}: autofillLineInputsFx.Props) {
	let storedQuantity = 0;
	let consecutiveDropConflicts = 0;
	while (true) {
		const runtime = yield* readRuntimeFx();
		const plan = yield* planLineInputAutofillFx({
			ownerItemId,
			lineId,
			runtime,
		});
		const next = plan.entry[0];
		if (next === undefined) {
			return {
				storedQuantity,
				remainingMissingQuantity: plan.remainingMissingQuantity,
			} satisfies autofillLineInputsFx.Result;
		}
		const runtimeOwner = yield* readRuntimeItemByIdFx({
			itemId: ownerItemId,
			runtime,
		});
		const runtimeSource = yield* readRuntimeItemByIdFx({
			itemId: next.sourceItemId,
			runtime,
		});
		const [owner, source] = [
			Option.getOrUndefined(yield* isGridRuntimeItemFx(runtimeOwner)),
			Option.getOrUndefined(yield* isGridRuntimeItemFx(runtimeSource)),
		];
		if (owner === undefined || source === undefined) {
			return {
				storedQuantity,
				remainingMissingQuantity: plan.remainingMissingQuantity,
			} satisfies autofillLineInputsFx.Result;
		}
		const outcome = yield* dropItemFx({
			sourceItemId: source.id,
			sourceLocation: source.location,
			sourceRevision: source.revision,
			target: {
				kind: "slot",
				inputStore: {
					lineId,
					inputIndex: next.inputIndex,
					quantity: next.quantity,
				},
				location: owner.location,
				occupant: {
					itemId: owner.id,
					revision: owner.revision,
				},
			},
		});
		const resolution = match(outcome)
			.with(
				{
					kind: DropItemResultKindEnumSchema.enum.StoreInput,
				},
				(result) =>
					({
						kind: "stored",
						quantity: result.storedQuantity,
					}) as const,
			)
			.with(
				{
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason: P.union(
						DropItemRejectedReasonEnumSchema.enum.StaleSource,
						DropItemRejectedReasonEnumSchema.enum.StaleTarget,
					),
				},
				() =>
					({
						kind: "conflict",
					}) as const,
			)
			.otherwise(
				() =>
					({
						kind: "rejected",
					}) as const,
			);
		if (
			resolution.kind === "conflict" &&
			consecutiveDropConflicts < maxConsecutiveDropConflicts
		) {
			consecutiveDropConflicts += 1;
			yield* Effect.yieldNow;
			continue;
		}
		if (resolution.kind !== "stored") {
			return {
				storedQuantity,
				remainingMissingQuantity: plan.remainingMissingQuantity,
			} satisfies autofillLineInputsFx.Result;
		}
		consecutiveDropConflicts = 0;
		storedQuantity += resolution.quantity;
	}
});
