import { Effect } from "effect";
import { match } from "ts-pattern";

import { isSameGridLocationFx } from "~/engine/location/read/isSameGridLocationFx";
import { commitMergeDropFx } from "~/engine/runtime/drop/commitMergeDropFx";
import { commitMoveDropFx } from "~/engine/runtime/drop/commitMoveDropFx";
import { commitStackDropFx } from "~/engine/runtime/drop/commitStackDropFx";
import { commitStoreInventoryDropFx } from "~/engine/runtime/drop/commitStoreInventoryDropFx";
import { commitStoreInputDropFx } from "~/engine/runtime/drop/commitStoreInputDropFx";
import { commitSwapDropFx } from "~/engine/runtime/drop/commitSwapDropFx";
import { readDropItemPreviewFx } from "~/engine/runtime/read/readDropItemPreviewFx";
import type { DropItemCommand } from "~/engine/runtime/schema/command/DropItemCommand";
import { DropItemIgnoredReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemIgnoredReasonEnumSchema";
import { DropItemRejectedReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemRejectedReasonEnumSchema";
import type { DropItemResultSchema } from "~/engine/runtime/schema/command/DropItemResultSchema";
import { DropItemResultKindEnumSchema } from "~/engine/runtime/schema/command/DropItemResultKindEnumSchema";
import { doDropCollisionExpectationsMatchFx } from "~/engine/runtime/read/doDropCollisionExpectationsMatchFx";

export namespace dropItemFx {
	export type Props = DropItemCommand;

	export type Result = DropItemResultSchema.Type;
}

/**
 * Resolves one requested item drop through the authoritative runtime command path.
 *
 * Preflight chooses semantic intent for feedback and dispatch only. Every commit
 * leaf rechecks identities, revisions, locations, and capacity against the latest
 * serialized runtime, then normalizes an expected race into Reject/Ignored instead
 * of letting renderer-observed state decide the gameplay outcome.
 */
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
	if (
		"collisions" in preflight &&
		target.expectedCollisions !== undefined &&
		!(yield* doDropCollisionExpectationsMatchFx({
			left: target.expectedCollisions,
			right: preflight.collisions,
		}))
	) {
		return {
			kind: DropItemResultKindEnumSchema.enum.Reject,
			reason: DropItemRejectedReasonEnumSchema.enum.StaleTarget,
			itemId: sourceItemId,
			targetItemId: target.occupant?.itemId,
		} satisfies dropItemFx.Result;
	}
	if (
		target.inputStore !== undefined &&
		preflight.kind !== DropItemResultKindEnumSchema.enum.StoreInput
	) {
		return {
			kind: DropItemResultKindEnumSchema.enum.Reject,
			reason: DropItemRejectedReasonEnumSchema.enum.Blocked,
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
	const expectedCollisions =
		target.expectedCollisions ??
		("collisions" in preflight
			? preflight.collisions
			: [
					{
						itemId: targetItemId,
						revision: targetRevision,
					},
				]);
	return yield* match(preflight)
		.with(
			{
				kind: DropItemResultKindEnumSchema.enum.Merge,
			},
			() =>
				commitMergeDropFx({
					destinationLocation: target.location,
					expectedCollisions,
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
					destinationLocation: target.location,
					expectedCollisions,
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
					destinationLocation: target.location,
					expectedCollisions,
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
					destinationLocation: target.location,
					expectedCollisions,
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
			(swap) =>
				commitSwapDropFx({
					destinationLocation: target.location,
					expectedCollisions,
					sourceItemId,
					sourceRevision,
					sourceLocation,
					targetItemId,
					targetRevision,
					targetLocation: swap.targetLocation,
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
