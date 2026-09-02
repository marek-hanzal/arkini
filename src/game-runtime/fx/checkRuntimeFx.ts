import { Effect } from "effect";
import { match } from "ts-pattern";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import { resolveItemFx } from "~/item-resolution/fx/resolveItemFx";
import { isItemPureWithIndexFn } from "~/game-runtime/fn/isItemPureWithIndexFn";
import { readItemPurityIndexFn } from "~/game-runtime/fn/readItemPurityIndexFn";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { DuplicateItemIdIssueSchema } from "~/game-runtime/schema/DuplicateItemIdIssueSchema";
import { ItemChargesIssueReasonEnumSchema } from "~/game-runtime/schema/ItemChargesIssueReasonEnumSchema";
import type { ItemChargesIssueSchema } from "~/game-runtime/schema/ItemChargesIssueSchema";
import type { ItemMaxCountIssueSchema } from "~/game-runtime/schema/ItemMaxCountIssueSchema";
import type { ItemStackSizeIssueSchema } from "~/game-runtime/schema/ItemStackSizeIssueSchema";
import { ItemTemporaryDurationIssueReasonEnumSchema } from "~/game-runtime/schema/ItemTemporaryDurationIssueReasonEnumSchema";
import type { ItemTemporaryDurationIssueSchema } from "~/game-runtime/schema/ItemTemporaryDurationIssueSchema";
import type { LocationOccupiedIssueSchema } from "~/game-runtime/schema/LocationOccupiedIssueSchema";
import type { LocationOutOfBoundsIssueSchema } from "~/game-runtime/schema/LocationOutOfBoundsIssueSchema";
import type { LocationScopeIssueSchema } from "~/game-runtime/schema/LocationScopeIssueSchema";
import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/RuntimeCheckIssueEnumSchema";
import type { RuntimeCheckResultSchema } from "~/game-runtime/schema/RuntimeCheckResultSchema";
import { indexGridLocationClaimsFn } from "~/item-location/fn/indexGridLocationClaimsFn";
import { isItemLocationScopeAllowedFn } from "~/item-location/fn/isItemLocationScopeAllowedFn";
import { readGridLocationClaimsFn } from "~/item-location/fn/readGridLocationClaimsFn";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { checkRuntimeDeliveriesFn } from "~/production-delivery/fn/checkRuntimeDeliveriesFn";
import { checkRuntimeInputLocationsFn } from "~/production-input/fn/checkRuntimeInputLocationsFn";
import { checkRuntimeJobsFn } from "~/production-job/fn/checkRuntimeJobsFn";
import { readReservedJobOutputQuantitiesFn } from "~/production-job/fn/readReservedJobOutputQuantitiesFn";
import { checkRuntimeDefaultLinesFn } from "~/production-line/fn/checkRuntimeDefaultLinesFn";

interface CheckRuntimeProps {
	runtime: RuntimeSchema.Type;
}

const checkRuntimeItemChargesFn = (runtime: RuntimeSchema.Type) => {
	const issues: ItemChargesIssueSchema.Type[] = [];

	for (const item of runtime.items) {
		if (item.remainingCharges === undefined) continue;
		const amount = item.item.charges?.amount;
		if (amount === undefined) {
			issues.push({
				type: RuntimeCheckIssueEnumSchema.enum.ItemCharges,
				itemId: item.id,
				remainingCharges: item.remainingCharges,
				reason: ItemChargesIssueReasonEnumSchema.enum.MissingConfig,
			});
			continue;
		}
		if (item.remainingCharges > amount) {
			issues.push({
				type: RuntimeCheckIssueEnumSchema.enum.ItemCharges,
				itemId: item.id,
				amount,
				remainingCharges: item.remainingCharges,
				reason: ItemChargesIssueReasonEnumSchema.enum.ExceedsAmount,
			});
			continue;
		}
		if (item.remainingCharges === amount) {
			issues.push({
				type: RuntimeCheckIssueEnumSchema.enum.ItemCharges,
				itemId: item.id,
				amount,
				remainingCharges: item.remainingCharges,
				reason: ItemChargesIssueReasonEnumSchema.enum.FullState,
			});
			continue;
		}
		if (
			item.remainingCharges === 0 &&
			!runtime.jobs.some((job) => job.ownerItemId === item.id)
		) {
			issues.push({
				type: RuntimeCheckIssueEnumSchema.enum.ItemCharges,
				itemId: item.id,
				amount,
				remainingCharges: item.remainingCharges,
				reason: ItemChargesIssueReasonEnumSchema.enum.DepletedIdle,
			});
		}
	}

	return issues;
};

const checkRuntimeItemIdsFn = (runtime: RuntimeSchema.Type) => {
	const issues: DuplicateItemIdIssueSchema.Type[] = [];

	for (const [index, item] of runtime.items.entries()) {
		if (issues.some((issue) => issue.itemId === item.id)) continue;
		if (runtime.items.slice(index + 1).some((candidate) => candidate.id === item.id)) {
			issues.push({
				itemId: item.id,
				type: RuntimeCheckIssueEnumSchema.enum.DuplicateItemId,
			});
		}
	}

	return issues;
};

const checkRuntimeItemQuantitiesFx = Effect.fn("checkRuntimeItemQuantitiesFx")(function* (
	runtime: RuntimeSchema.Type,
) {
	const stackIssues: ItemStackSizeIssueSchema.Type[] = [];
	const maxCountIssues: ItemMaxCountIssueSchema.Type[] = [];
	const purityIndex = readItemPurityIndexFn(runtime);
	const liveByCanonicalItemId = new Map<
		IdSchema.Type,
		{
			readonly itemIds: IdSchema.Type[];
			quantity: number;
		}
	>();

	for (const item of runtime.items) {
		const maxStackSize = isItemPureWithIndexFn({
			index: purityIndex,
			item,
			runtime,
		})
			? item.item.maxStackSize
			: 1;
		if (item.quantity > maxStackSize) {
			stackIssues.push({
				canonicalItemId: item.item.id,
				itemId: item.id,
				maxStackSize,
				quantity: item.quantity,
				type: RuntimeCheckIssueEnumSchema.enum.ItemStackSize,
			});
		}
		const live = liveByCanonicalItemId.get(item.item.id);
		if (live === undefined) {
			liveByCanonicalItemId.set(item.item.id, {
				itemIds: [
					item.id,
				],
				quantity: item.quantity,
			});
		} else {
			live.itemIds.push(item.id);
			live.quantity += item.quantity;
		}
	}

	const reserved = readReservedJobOutputQuantitiesFn({
		runtime,
	});
	const canonicalItemIds = new Set<IdSchema.Type>([
		...liveByCanonicalItemId.keys(),
		...reserved.keys(),
	]);
	const config = yield* GameConfigFx;

	for (const itemId of canonicalItemIds) {
		const item =
			config.items[itemId] ??
			(yield* resolveItemFx({
				itemId,
			}));
		if (item.maxCount === undefined) continue;

		const live = liveByCanonicalItemId.get(itemId);
		const liveQuantity = live?.quantity ?? 0;
		const reservation = reserved.get(itemId);
		const reservedQuantity = reservation?.quantity ?? 0;
		const quantity = liveQuantity + reservedQuantity;
		if (quantity <= item.maxCount) continue;

		maxCountIssues.push({
			itemId,
			itemIds: live?.itemIds ?? [],
			jobIds: reservation?.jobIds ?? [],
			liveQuantity,
			reservedQuantity,
			maxCount: item.maxCount,
			quantity,
			type: RuntimeCheckIssueEnumSchema.enum.ItemMaxCount,
		});
	}

	return [
		...stackIssues,
		...maxCountIssues,
	];
});

const checkRuntimeItemTemporaryDurationsFn = (runtime: RuntimeSchema.Type) => {
	const issues: ItemTemporaryDurationIssueSchema.Type[] = [];

	for (const item of runtime.items) {
		if (item.item.type !== TypeSchema.enum.Temporary) {
			if (item.remainingDurationMs !== undefined) {
				issues.push({
					type: RuntimeCheckIssueEnumSchema.enum.ItemTemporaryDuration,
					itemId: item.id,
					remainingDurationMs: item.remainingDurationMs,
					location: item.location,
					reason: ItemTemporaryDurationIssueReasonEnumSchema.enum.UnexpectedState,
				});
			}
			continue;
		}

		if (item.location.scope !== LocationScopeEnumSchema.enum.Board) {
			issues.push({
				type: RuntimeCheckIssueEnumSchema.enum.ItemTemporaryDuration,
				itemId: item.id,
				durationMs: item.item.durationMs,
				remainingDurationMs: item.remainingDurationMs,
				location: item.location,
				reason: ItemTemporaryDurationIssueReasonEnumSchema.enum.NotBoard,
			});
		}
		if (item.remainingDurationMs === undefined) {
			issues.push({
				type: RuntimeCheckIssueEnumSchema.enum.ItemTemporaryDuration,
				itemId: item.id,
				durationMs: item.item.durationMs,
				location: item.location,
				reason: ItemTemporaryDurationIssueReasonEnumSchema.enum.MissingState,
			});
			continue;
		}
		if (item.remainingDurationMs > item.item.durationMs) {
			issues.push({
				type: RuntimeCheckIssueEnumSchema.enum.ItemTemporaryDuration,
				itemId: item.id,
				durationMs: item.item.durationMs,
				remainingDurationMs: item.remainingDurationMs,
				location: item.location,
				reason: ItemTemporaryDurationIssueReasonEnumSchema.enum.ExceedsDuration,
			});
		}
	}

	return issues;
};

const checkRuntimeLocationsFn = (config: GameConfigSchema.Type, runtime: RuntimeSchema.Type) => {
	const items: {
		readonly item: RuntimeItemSchema.Type;
		readonly location: GridLocationSchema.Type;
	}[] = [];
	for (const item of runtime.items) {
		if (
			item.location.scope === LocationScopeEnumSchema.enum.Board ||
			item.location.scope === LocationScopeEnumSchema.enum.Inventory ||
			item.location.scope === LocationScopeEnumSchema.enum.Toolbar
		) {
			items.push({
				item,
				location: item.location,
			});
		} else if (item.location.scope === LocationScopeEnumSchema.enum.Delivery) {
			items.push({
				item,
				location: item.location.origin,
			});
		}
	}
	const scopeIssues: LocationScopeIssueSchema.Type[] = [];
	const boundsIssues: LocationOutOfBoundsIssueSchema.Type[] = [];
	const occupancyIssues: LocationOccupiedIssueSchema.Type[] = [];

	for (const { item, location } of items) {
		const configuredScope = item.item.scope;
		if (
			!isItemLocationScopeAllowedFn({
				item: item.item,
				locationScope: location.scope,
			})
		) {
			scopeIssues.push({
				configuredScope,
				itemId: item.id,
				location,
				type: RuntimeCheckIssueEnumSchema.enum.LocationScope,
			});
		}

		const size = match(location.scope)
			.with(LocationScopeEnumSchema.enum.Board, () => config.meta.board)
			.with(LocationScopeEnumSchema.enum.Inventory, () => config.meta.inventory)
			.with(LocationScopeEnumSchema.enum.Toolbar, () => ({
				width: config.meta.toolbarSize ?? 0,
				height: 1,
			}))
			.exhaustive();
		if (location.position.x >= size.width || location.position.y >= size.height) {
			boundsIssues.push({
				itemId: item.id,
				location,
				size,
				type: RuntimeCheckIssueEnumSchema.enum.LocationOutOfBounds,
			});
		}
	}

	const claimsByLocation = indexGridLocationClaimsFn(
		readGridLocationClaimsFn({
			runtime,
		}),
	);
	for (const claims of claimsByLocation.values()) {
		const first = claims[0];
		if (claims.length <= 1 || first === undefined) continue;
		occupancyIssues.push({
			itemIds: claims.map((claim) => claim.itemId),
			location: first.location,
			type: RuntimeCheckIssueEnumSchema.enum.LocationOccupied,
		});
	}

	return [
		...scopeIssues,
		...boundsIssues,
		...occupancyIssues,
	];
};

/** Runs every explicit invariant checker against one candidate runtime. */
export const checkRuntimeFx = Effect.fn("checkRuntimeFx")(function* ({
	runtime,
}: CheckRuntimeProps) {
	const config = yield* GameConfigFx;
	const itemChargeIssues = checkRuntimeItemChargesFn(runtime);
	const itemIdIssues = checkRuntimeItemIdsFn(runtime);
	const itemQuantityIssues = yield* checkRuntimeItemQuantitiesFx(runtime);
	const itemTemporaryDurationIssues = checkRuntimeItemTemporaryDurationsFn(runtime);
	const defaultLineIssues = checkRuntimeDefaultLinesFn({
		runtime,
	});
	const inputLocationIssues = checkRuntimeInputLocationsFn({
		runtime,
	});
	const deliveryIssues = checkRuntimeDeliveriesFn({
		runtime,
	});
	const jobIssues = checkRuntimeJobsFn({
		runtime,
	});
	const locationIssues = checkRuntimeLocationsFn(config, runtime);

	return {
		issues: [
			...itemChargeIssues,
			...itemIdIssues,
			...itemQuantityIssues,
			...itemTemporaryDurationIssues,
			...defaultLineIssues,
			...inputLocationIssues,
			...deliveryIssues,
			...jobIssues,
			...locationIssues,
		],
	} satisfies RuntimeCheckResultSchema.Type;
});
