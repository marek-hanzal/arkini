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
import type { DropItemCommand } from "~/engine/runtime/DropItemCommand";
import { DropItemIgnoredReason } from "~/engine/runtime/DropItemResult";
import { DropItemRejectedReason } from "~/engine/runtime/DropItemResult";
import type { DropItemResult } from "~/engine/runtime/DropItemResult";
import { DropItemResultKind } from "~/engine/runtime/DropItemResult";

export namespace dropItemFx {
	export type Props = DropItemCommand;

	export type Result = DropItemResult;
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
			kind: DropItemResultKind.Reject,
			reason: DropItemRejectedReason.UnsupportedTarget,
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
			kind: DropItemResultKind.Ignored,
			reason: DropItemIgnoredReason.SameLocation,
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
	if (preflight.kind === DropItemResultKind.Reject) {
		return {
			kind: DropItemResultKind.Reject,
			reason: preflight.reason,
			itemId: sourceItemId,
			...(target.occupant === null
				? {}
				: {
						targetItemId: target.occupant.itemId,
					}),
		} satisfies dropItemFx.Result;
	}
	if (target.inputStore !== undefined && preflight.kind !== DropItemResultKind.StoreInput) {
		return {
			kind: DropItemResultKind.Reject,
			reason: DropItemRejectedReason.Blocked,
			itemId: sourceItemId,
			...(target.occupant === null
				? {}
				: {
						targetItemId: target.occupant.itemId,
					}),
		} satisfies dropItemFx.Result;
	}

	if (target.occupant === null) {
		if (preflight.kind !== DropItemResultKind.Move) {
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
				kind: DropItemResultKind.Merge,
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
				kind: DropItemResultKind.StoreInventory,
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
				kind: DropItemResultKind.StoreInput,
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
				kind: DropItemResultKind.Stack,
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
				kind: DropItemResultKind.Swap,
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
				kind: DropItemResultKind.Move,
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
				kind: DropItemResultKind.Ignored,
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
