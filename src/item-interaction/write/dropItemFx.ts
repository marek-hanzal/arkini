import { Effect } from "effect";
import { match } from "ts-pattern";

import { commitMergeDropFx } from "~/item-interaction/drop/commitMergeDropFx";
import { commitMoveDropFx } from "~/item-interaction/drop/commitMoveDropFx";
import { commitStackDropFx } from "~/item-interaction/drop/commitStackDropFx";
import { commitStoreInventoryDropFx } from "~/item-interaction/drop/commitStoreInventoryDropFx";
import { commitStoreInputDropFx } from "~/item-interaction/drop/commitStoreInputDropFx";
import { commitSwapDropFx } from "~/item-interaction/drop/commitSwapDropFx";
import { readDropItemPreviewFx } from "~/item-interaction/read/readDropItemPreviewFx";
import type { DropItemCommand } from "~/item-interaction/DropItemCommand";
import type { DropItemResult } from "~/item-interaction/DropItemResult";
import { DropItemResultKind } from "~/item-interaction/DropItemResult";

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
			...(target.kind === "slot" && target.occupant !== null
				? {
						targetItemId: target.occupant.itemId,
					}
				: {}),
		} satisfies dropItemFx.Result;
	}
	if (preflight.kind === DropItemResultKind.Ignored) {
		return {
			kind: DropItemResultKind.Ignored,
			reason: preflight.reason,
			itemId: sourceItemId,
			location: sourceLocation,
		} satisfies dropItemFx.Result;
	}
	if (target.kind === "unsupported") {
		return yield* Effect.die(
			new Error(`Unsupported drop target unexpectedly resolved as "${preflight.kind}".`),
		);
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
		.exhaustive();
});
