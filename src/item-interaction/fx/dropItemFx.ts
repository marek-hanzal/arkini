import { Effect } from "effect";
import { match } from "ts-pattern";

import { commitMergeDropFx } from "~/item-interaction/fx/commitMergeDropFx";
import { commitMoveDropFx } from "~/item-interaction/fx/commitMoveDropFx";
import { commitStackDropFx } from "~/item-interaction/fx/commitStackDropFx";
import { commitStoreInventoryDropFx } from "~/item-interaction/fx/commitStoreInventoryDropFx";
import { commitStoreInputDropFx } from "~/item-interaction/fx/commitStoreInputDropFx";
import { commitSwapDropFx } from "~/item-interaction/fx/commitSwapDropFx";
import { readDropItemPreviewFx } from "~/item-interaction/fx/readDropItemPreviewFx";
import type { DropItemCommand } from "~/item-interaction/type/DropItemCommand";
import type { DropItemResult } from "~/item-interaction/type/DropItemResult";
import { DropItemResultKind } from "~/item-interaction/type/DropItemResult";

/**
 * Resolves one requested item drop through the authoritative runtime command path.
 *
 * Preflight chooses semantic intent for feedback and dispatch only. Every commit
 * leaf rechecks identities, revisions, locations, and capacity against the latest
 * serialized runtime, then normalizes an expected race into Reject/Ignored instead
 * of letting renderer-observed state decide the gameplay outcome.
 */
export const dropItemFx = Effect.fn("dropItemFx")(function* ({
	interactionLayer,
	sourceItemId,
	sourceRevision,
	sourceLocation,
	target,
}: DropItemCommand) {
	const preflight = yield* readDropItemPreviewFx({
		interactionLayer,
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
		} satisfies DropItemResult;
	}
	if (preflight.kind === DropItemResultKind.Ignored) {
		return {
			kind: DropItemResultKind.Ignored,
			reason: preflight.reason,
			itemId: sourceItemId,
			location: sourceLocation,
		} satisfies DropItemResult;
	}
	if (target.kind === "unsupported") {
		return yield* Effect.die(
			new Error(`Unsupported drop target unexpectedly resolved as "${preflight.kind}".`),
		);
	}

	if (preflight.kind === DropItemResultKind.Move) {
		return yield* commitMoveDropFx({
			interactionLayer,
			sourceItemId,
			sourceRevision,
			sourceLocation,
			targetLocation: target.location,
		});
	}
	if (target.occupant === null) {
		return yield* Effect.die(
			new Error(`Empty-slot drop preview unexpectedly resolved as "${preflight.kind}".`),
		);
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
					interactionLayer,
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
					interactionLayer,
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
					interactionLayer,
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
					interactionLayer,
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
					interactionLayer,
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
			() => Effect.die(new Error("Move preview was already dispatched.")),
		)
		.exhaustive();
});
