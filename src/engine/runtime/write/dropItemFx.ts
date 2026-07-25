import { Effect } from "effect";
import { match } from "ts-pattern";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { isSameGridLocationFx } from "~/engine/location/read/isSameGridLocationFx";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { commitMergeDropFx } from "~/engine/runtime/drop/commitMergeDropFx";
import { commitMoveDropFx } from "~/engine/runtime/drop/commitMoveDropFx";
import { commitStackDropFx } from "~/engine/runtime/drop/commitStackDropFx";
import { commitStoreInventoryDropFx } from "~/engine/runtime/drop/commitStoreInventoryDropFx";
import { commitStoreInputDropFx } from "~/engine/runtime/drop/commitStoreInputDropFx";
import { commitSwapDropFx } from "~/engine/runtime/drop/commitSwapDropFx";
import { readDropItemPreviewFx } from "~/engine/runtime/read/readDropItemPreviewFx";
import { DropItemIgnoredReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemIgnoredReasonEnumSchema";
import { DropItemRejectedReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemRejectedReasonEnumSchema";
import type { DropItemResultSchema } from "~/engine/runtime/schema/command/DropItemResultSchema";
import { DropItemResultKindEnumSchema } from "~/engine/runtime/schema/command/DropItemResultKindEnumSchema";

export namespace dropItemFx {
	export interface Props {
		readonly sourceItemId: IdSchema.Type;
		readonly sourceRevision: RevisionSchema.Type;
		readonly sourceLocation: GridLocationSchema.Type;
		readonly target:
			| {
					readonly kind: "slot";
					readonly location: GridLocationSchema.Type;
					readonly occupant: {
						readonly itemId: IdSchema.Type;
						readonly revision: RevisionSchema.Type;
					} | null;
			  }
			| {
					readonly kind: "unsupported";
			  };
	}

	export type Result = DropItemResultSchema.Type;
}

/** Resolves one requested item drop through the current atomic runtime command path. */
export const dropItemFx = Effect.fn("dropItemFx")(function* ({
	sourceItemId,
	sourceRevision,
	sourceLocation,
	target,
}: dropItemFx.Props) {
	if (target.kind === "unsupported") {
		return {
			kind: DropItemResultKindEnumSchema.enum.Reject,
			reason: DropItemRejectedReasonEnumSchema.enum.UnsupportedTarget,
			itemId: sourceItemId,
		} satisfies dropItemFx.Result;
	}

	if (
		yield* isSameGridLocationFx({
			left: sourceLocation,
			right: target.location,
		})
	) {
		return {
			kind: DropItemResultKindEnumSchema.enum.Ignored,
			reason: DropItemIgnoredReasonEnumSchema.enum.SameLocation,
			itemId: sourceItemId,
			location: sourceLocation,
		} satisfies dropItemFx.Result;
	}

	const preflight = yield* readDropItemPreviewFx({
		sourceItemId,
		sourceRevision,
		sourceLocation,
		target,
	});
	if (preflight.kind === DropItemResultKindEnumSchema.enum.Reject) {
		return {
			kind: DropItemResultKindEnumSchema.enum.Reject,
			reason: preflight.reason,
			itemId: sourceItemId,
			...(target.occupant === null
				? {}
				: {
						targetItemId: target.occupant.itemId,
					}),
		} satisfies dropItemFx.Result;
	}

	if (target.occupant === null) {
		if (preflight.kind !== DropItemResultKindEnumSchema.enum.Move) {
			return yield* Effect.die(
				new Error(`Empty-slot drop preview unexpectedly resolved as "${preflight.kind}".`),
			);
		}
		return yield* commitMoveDropFx({
			sourceItemId,
			sourceRevision,
			sourceLocation,
			targetLocation: target.location,
		});
	}

	const targetItemId = target.occupant.itemId;
	const targetRevision = target.occupant.revision;
	const targetLocation = target.location;
	return yield* match(preflight)
		.with(
			{
				kind: DropItemResultKindEnumSchema.enum.Merge,
			},
			() =>
				commitMergeDropFx({
					sourceItemId,
					sourceRevision,
					targetItemId,
					targetRevision,
				}),
		)
		.with(
			{
				kind: DropItemResultKindEnumSchema.enum.StoreInventory,
			},
			() =>
				commitStoreInventoryDropFx({
					sourceItemId,
					sourceRevision,
					sourceLocation,
					inventoryItemId: targetItemId,
					inventoryRevision: targetRevision,
					inventoryLocation: targetLocation,
				}),
		)
		.with(
			{
				kind: DropItemResultKindEnumSchema.enum.StoreInput,
			},
			(storeInput) =>
				commitStoreInputDropFx({
					sourceItemId,
					sourceRevision,
					sourceLocation,
					targetItemId,
					targetRevision,
					targetLocation,
					lineId: storeInput.lineId,
					inputIndex: storeInput.inputIndex,
					quantity: storeInput.quantity,
				}),
		)
		.with(
			{
				kind: DropItemResultKindEnumSchema.enum.Stack,
			},
			() =>
				commitStackDropFx({
					sourceItemId,
					sourceRevision,
					sourceLocation,
					targetItemId,
					targetRevision,
					targetLocation,
				}),
		)
		.with(
			{
				kind: DropItemResultKindEnumSchema.enum.Swap,
			},
			() =>
				commitSwapDropFx({
					sourceItemId,
					sourceRevision,
					sourceLocation,
					targetItemId,
					targetRevision,
					targetLocation,
				}),
		)
		.with(
			{
				kind: DropItemResultKindEnumSchema.enum.Move,
			},
			(unexpected) =>
				Effect.die(
					new Error(
						`Occupied drop preview unexpectedly resolved as "${unexpected.kind}".`,
					),
				),
		)
		.with(
			{
				kind: DropItemResultKindEnumSchema.enum.Ignored,
			},
			(unexpected) =>
				Effect.die(
					new Error(
						`Occupied drop preview unexpectedly resolved as "${unexpected.kind}".`,
					),
				),
		)
		.exhaustive();
});
