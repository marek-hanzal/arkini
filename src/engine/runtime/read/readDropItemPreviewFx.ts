import { Effect, Option } from "effect";

import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import { areGridLocationsWithinBoundsFx } from "~/engine/location/read/areGridLocationsWithinBoundsFx";
import { isItemLocationScopeAllowedFx } from "~/engine/location/read/isItemLocationScopeAllowedFx";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { resolveLineInputStoreFx } from "~/engine/input/fx/resolveLineInputStoreFx";
import { isSameGridLocationFx } from "~/engine/location/read/isSameGridLocationFx";
import { readGridItemDestinationFx } from "~/engine/location/read/readGridItemDestinationFx";
import { readGridLocationClaimAt } from "~/engine/location/read/readGridLocationClaimAt";
import { readGridLocationClaimsFx } from "~/engine/location/read/readGridLocationClaimsFx";
import { resolveMergeRuleFx } from "~/engine/merge/fx/resolveMergeRuleFx";
import type { DropItemCommand } from "~/engine/runtime/schema/command/DropItemCommand";
import { isBoardRuntimeItemFx } from "~/engine/runtime/read/isBoardRuntimeItemFx";
import { isGridRuntimeItemFx } from "~/engine/runtime/read/isGridRuntimeItemFx";
import { readDropItemStackRejectedReasonFx } from "~/engine/runtime/read/readDropItemStackRejectedReasonFx";
import { readItemStackResolutionFx } from "~/engine/runtime/read/readItemStackResolutionFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { readStoreItemInInventoryPlanFx } from "~/engine/runtime/fx/readStoreItemInInventoryPlanFx";
import { DropItemIgnoredReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemIgnoredReasonEnumSchema";
import { DropItemRejectedReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemRejectedReasonEnumSchema";
import { DropItemResultKindEnumSchema } from "~/engine/runtime/schema/command/DropItemResultKindEnumSchema";

export namespace readDropItemPreviewFx {
	export type Props = DropItemCommand;

	export type Result =
		| {
				readonly kind:
					| typeof DropItemResultKindEnumSchema.enum.Merge
					| typeof DropItemResultKindEnumSchema.enum.StoreInventory
					| typeof DropItemResultKindEnumSchema.enum.Stack;
				readonly collisions: ReadonlyArray<{
					readonly itemId: string;
					readonly revision: string;
				}>;
		  }
		| {
				readonly kind: typeof DropItemResultKindEnumSchema.enum.Move;
				readonly collisions: readonly [];
		  }
		| {
				readonly kind: typeof DropItemResultKindEnumSchema.enum.Swap;
				readonly collisions: ReadonlyArray<{
					readonly itemId: string;
					readonly revision: string;
				}>;
				readonly targetLocation: GridLocationSchema.Type;
		  }
		| {
				readonly kind: typeof DropItemResultKindEnumSchema.enum.StoreInput;
				readonly lineId: string;
				readonly inputIndex: number;
				readonly quantity: number;
				readonly collisions: ReadonlyArray<{
					readonly itemId: string;
					readonly revision: string;
				}>;
		  }
		| {
				readonly kind: typeof DropItemResultKindEnumSchema.enum.Ignored;
				readonly reason: DropItemIgnoredReasonEnumSchema.Type;
		  }
		| {
				readonly kind: typeof DropItemResultKindEnumSchema.enum.Reject;
				readonly reason: DropItemRejectedReasonEnumSchema.Type;
		  };
}

const rejected = (reason: DropItemRejectedReasonEnumSchema.Type): readDropItemPreviewFx.Result => ({
	kind: DropItemResultKindEnumSchema.enum.Reject,
	reason,
});

/** Reads the current authoritative semantic kind of one prospective item drop without mutating runtime. */
export const readDropItemPreviewFx = Effect.fnUntraced(function* ({
	sourceItemId,
	sourceRevision,
	sourceLocation,
	target,
}: readDropItemPreviewFx.Props) {
	if (target.kind === "unsupported") {
		return rejected(DropItemRejectedReasonEnumSchema.enum.UnsupportedTarget);
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
		} satisfies readDropItemPreviewFx.Result;
	}
	const runtime = yield* readRuntimeFx();
	const runtimeSource = runtime.items.find((item) => item.id === sourceItemId);
	if (runtimeSource === undefined || runtimeSource.revision !== sourceRevision) {
		return rejected(DropItemRejectedReasonEnumSchema.enum.StaleSource);
	}
	const source = Option.getOrUndefined(yield* isGridRuntimeItemFx(runtimeSource));
	if (source === undefined) {
		return rejected(DropItemRejectedReasonEnumSchema.enum.InvalidSource);
	}
	if (
		!(yield* isSameGridLocationFx({
			left: source.location,
			right: sourceLocation,
		}))
	) {
		return rejected(DropItemRejectedReasonEnumSchema.enum.StaleSource);
	}
	const destination = yield* readGridItemDestinationFx({
		excludedItemIds: new Set([
			source.id,
		]),
		item: source.item,
		location: target.location,
		runtime,
	});
	if (
		!(yield* isItemLocationScopeAllowedFx({
			item: source.item,
			locationScope: target.location.scope,
		}))
	) {
		return rejected(DropItemRejectedReasonEnumSchema.enum.InvalidTarget);
	}
	if (
		!(yield* areGridLocationsWithinBoundsFx({
			locations: destination.locations,
			scope: target.location.scope,
		}))
	) {
		return rejected(DropItemRejectedReasonEnumSchema.enum.InvalidTarget);
	}
	if (destination.claims.some((claim) => claim.kind === "delivery-origin")) {
		return rejected(DropItemRejectedReasonEnumSchema.enum.Blocked);
	}
	const collisions = destination.claims.map((claim) => {
		const collision = runtime.items.find((item) => item.id === claim.itemId);
		if (collision === undefined) {
			throw new Error(
				`Drop collision ${claim.itemId} disappeared from the runtime snapshot.`,
			);
		}
		return {
			itemId: collision.id,
			revision: collision.revision,
		};
	});
	if (target.occupant === null) {
		if (destination.claims.length > 0) {
			return rejected(DropItemRejectedReasonEnumSchema.enum.Occupied);
		}
		return {
			kind: DropItemResultKindEnumSchema.enum.Move,
			collisions: [],
		} satisfies readDropItemPreviewFx.Result;
	}

	const targetOccupant = target.occupant;
	const runtimeTargetItem = runtime.items.find((item) => item.id === targetOccupant.itemId);
	if (runtimeTargetItem === undefined || runtimeTargetItem.revision !== targetOccupant.revision) {
		return rejected(DropItemRejectedReasonEnumSchema.enum.StaleTarget);
	}
	const targetItem = Option.getOrUndefined(yield* isGridRuntimeItemFx(runtimeTargetItem));
	if (targetItem === undefined) {
		return rejected(DropItemRejectedReasonEnumSchema.enum.InvalidTarget);
	}
	const hitClaim = readGridLocationClaimAt({
		claims: yield* readGridLocationClaimsFx({
			runtime,
		}),
		location: target.hitLocation ?? target.location,
	});
	if (
		hitClaim?.kind !== "occupant" ||
		hitClaim.itemId !== targetItem.id ||
		!destination.claims.some(
			(claim) => claim.kind === "occupant" && claim.itemId === targetItem.id,
		)
	) {
		return rejected(DropItemRejectedReasonEnumSchema.enum.StaleTarget);
	}
	const hasAdditionalCollision = collisions.some(
		(collision) => collision.itemId !== targetItem.id,
	);
	const boardSource = Option.getOrUndefined(yield* isBoardRuntimeItemFx(source));
	const boardTarget = Option.getOrUndefined(yield* isBoardRuntimeItemFx(targetItem));
	if (
		boardSource !== undefined &&
		boardTarget !== undefined &&
		boardSource.location.space !== boardTarget.location.space
	) {
		return rejected(DropItemRejectedReasonEnumSchema.enum.InvalidTarget);
	}
	const oneBoardItem = (boardSource === undefined) !== (boardTarget === undefined);
	const boardItem = boardSource ?? boardTarget;
	if (
		oneBoardItem &&
		boardItem !== undefined &&
		boardItem.location.space !== runtime.currentSpace
	) {
		return rejected(DropItemRejectedReasonEnumSchema.enum.InvalidTarget);
	}
	if (targetItem.item.type === ItemEnumSchema.enum.Inventory) {
		if (hasAdditionalCollision) {
			return rejected(DropItemRejectedReasonEnumSchema.enum.Occupied);
		}
		if (
			source.location.scope === LocationScopeEnumSchema.enum.Inventory ||
			!(yield* isItemLocationScopeAllowedFx({
				item: source.item,
				locationScope: LocationScopeEnumSchema.enum.Inventory,
			}))
		) {
			return rejected(DropItemRejectedReasonEnumSchema.enum.InvalidTarget);
		}
		const storagePlan = yield* readStoreItemInInventoryPlanFx({
			item: source,
			runtime,
		}).pipe(Effect.option);
		return Option.isSome(storagePlan)
			? {
					kind: DropItemResultKindEnumSchema.enum.StoreInventory,
					collisions,
				}
			: rejected(DropItemRejectedReasonEnumSchema.enum.Blocked);
	}
	if (targetItem.location.scope === LocationScopeEnumSchema.enum.Board) {
		const mergeRule = yield* resolveMergeRuleFx({
			source,
			target: targetItem,
		}).pipe(Effect.option);
		if (Option.isSome(mergeRule)) {
			if (hasAdditionalCollision) {
				return rejected(DropItemRejectedReasonEnumSchema.enum.Occupied);
			}
			return {
				kind: DropItemResultKindEnumSchema.enum.Merge,
				collisions,
			} satisfies readDropItemPreviewFx.Result;
		}
	}
	const inputStore = yield* resolveLineInputStoreFx({
		lineId: target.inputStore?.lineId,
		inputIndex: target.inputStore?.inputIndex,
		owner: targetItem,
		requestedQuantity: target.inputStore?.quantity,
		runtime,
		source,
	});
	if (inputStore !== undefined) {
		if (hasAdditionalCollision) {
			return rejected(DropItemRejectedReasonEnumSchema.enum.Occupied);
		}
		return {
			kind: DropItemResultKindEnumSchema.enum.StoreInput,
			lineId: inputStore.lineId,
			inputIndex: inputStore.inputIndex,
			quantity: inputStore.quantity,
			collisions,
		} satisfies readDropItemPreviewFx.Result;
	}
	const stackResolution = yield* readItemStackResolutionFx({
		runtime,
		sourceItemId,
		sourceRevision,
		sourceLocation,
		targetItemId: targetItem.id,
		targetRevision: targetOccupant.revision,
		targetLocation: targetItem.location,
	});
	if (stackResolution.kind === "available") {
		if (hasAdditionalCollision) {
			return rejected(DropItemRejectedReasonEnumSchema.enum.Occupied);
		}
		return {
			kind: DropItemResultKindEnumSchema.enum.Stack,
			collisions,
		} satisfies readDropItemPreviewFx.Result;
	}
	if (stackResolution.kind === "blocked") {
		return rejected(
			yield* readDropItemStackRejectedReasonFx({
				reason: stackResolution.reason,
			}),
		);
	}
	const sourceScopeAllowed = yield* isItemLocationScopeAllowedFx({
		item: source.item,
		locationScope: targetItem.location.scope,
	});
	const targetScopeAllowed = yield* isItemLocationScopeAllowedFx({
		item: targetItem.item,
		locationScope: source.location.scope,
	});
	if (!sourceScopeAllowed || !targetScopeAllowed) {
		return rejected(DropItemRejectedReasonEnumSchema.enum.InvalidTarget);
	}
	const collisionIds = destination.claims.map((claim) => claim.itemId);
	if (!collisionIds.includes(targetItem.id)) {
		return rejected(DropItemRejectedReasonEnumSchema.enum.StaleTarget);
	}
	return {
		kind: DropItemResultKindEnumSchema.enum.Swap,
		collisions,
		targetLocation: targetItem.location,
	} satisfies readDropItemPreviewFx.Result;
});
