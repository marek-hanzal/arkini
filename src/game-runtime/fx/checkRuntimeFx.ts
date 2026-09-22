import { checkRuntimeItemSchedulesFn } from "~/item-schedule/fn/checkRuntimeItemSchedulesFn";
import { Effect } from "effect";

import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import { isItemPureWithIndexFn } from "~/game-runtime/fn/isItemPureWithIndexFn";
import { readItemPurityIndexFn } from "~/game-runtime/fn/readItemPurityIndexFn";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { DuplicateItemIdIssueSchema } from "~/game-runtime/schema/DuplicateItemIdIssueSchema";
import { ItemUnitsIssueReasonEnumSchema } from "~/game-runtime/schema/ItemUnitsIssueReasonEnumSchema";
import type { ItemUnitsIssueSchema } from "~/game-runtime/schema/ItemUnitsIssueSchema";
import type { ItemStackSizeIssueSchema } from "~/game-runtime/schema/ItemStackSizeIssueSchema";
import type { LocationOccupiedIssueSchema } from "~/game-runtime/schema/LocationOccupiedIssueSchema";
import type { LocationOutOfBoundsIssueSchema } from "~/game-runtime/schema/LocationOutOfBoundsIssueSchema";
import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/RuntimeCheckIssueEnumSchema";
import type { RuntimeCheckResultSchema } from "~/game-runtime/schema/RuntimeCheckResultSchema";
import { indexGridLocationClaimsFn } from "~/item-location/fn/indexGridLocationClaimsFn";
import { readGridLocationClaimsFn } from "~/item-location/fn/readGridLocationClaimsFn";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { checkRuntimeDeliveriesFn } from "~/production-delivery/fn/checkRuntimeDeliveriesFn";
import { checkRuntimeInputLocationsFn } from "~/production-input/fn/checkRuntimeInputLocationsFn";
import { checkRuntimeJobsFn } from "~/production-job/fn/checkRuntimeJobsFn";
import { checkRuntimeDefaultLinesFn } from "~/production-line/fn/checkRuntimeDefaultLinesFn";

interface CheckRuntimeProps {
	runtime: RuntimeSchema.Type;
}

const checkRuntimeItemUnitsFn = (runtime: RuntimeSchema.Type) => {
	const issues: ItemUnitsIssueSchema.Type[] = [];

	for (const item of runtime.items) {
		if (item.remainingUnits === undefined) continue;
		const amount = item.item.units?.amount;
		if (amount === undefined) {
			issues.push({
				type: RuntimeCheckIssueEnumSchema.enum.ItemUnits,
				itemId: item.id,
				remainingUnits: item.remainingUnits,
				reason: ItemUnitsIssueReasonEnumSchema.enum.MissingConfig,
			});
			continue;
		}
		if (item.remainingUnits > amount) {
			issues.push({
				type: RuntimeCheckIssueEnumSchema.enum.ItemUnits,
				itemId: item.id,
				amount,
				remainingUnits: item.remainingUnits,
				reason: ItemUnitsIssueReasonEnumSchema.enum.ExceedsAmount,
			});
			continue;
		}
		if (item.remainingUnits === amount) {
			issues.push({
				type: RuntimeCheckIssueEnumSchema.enum.ItemUnits,
				itemId: item.id,
				amount,
				remainingUnits: item.remainingUnits,
				reason: ItemUnitsIssueReasonEnumSchema.enum.FullState,
			});
			continue;
		}
		if (item.remainingUnits === 0 && !runtime.jobs.some((job) => job.ownerItemId === item.id)) {
			issues.push({
				type: RuntimeCheckIssueEnumSchema.enum.ItemUnits,
				itemId: item.id,
				amount,
				remainingUnits: item.remainingUnits,
				reason: ItemUnitsIssueReasonEnumSchema.enum.DepletedIdle,
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
	const purityIndex = readItemPurityIndexFn(runtime);

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
	}

	return stackIssues;
});

const checkRuntimeLocationsFn = (config: GameConfigSchema.Type, runtime: RuntimeSchema.Type) => {
	const items: {
		readonly item: RuntimeItemSchema.Type;
		readonly location: BoardLocationSchema.Type;
	}[] = [];
	for (const item of runtime.items) {
		if (item.location.scope === LocationScopeEnumSchema.enum.Board) {
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
	const boundsIssues: LocationOutOfBoundsIssueSchema.Type[] = [];
	const occupancyIssues: LocationOccupiedIssueSchema.Type[] = [];

	for (const { item, location } of items) {
		const size = config.meta.board;
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
		...boundsIssues,
		...occupancyIssues,
	];
};

/** Runs every explicit invariant checker against one candidate runtime. */
export const checkRuntimeFx = Effect.fn("checkRuntimeFx")(function* ({
	runtime,
}: CheckRuntimeProps) {
	const config = yield* GameConfigFx;
	const itemUnitIssues = checkRuntimeItemUnitsFn(runtime);
	const itemIdIssues = checkRuntimeItemIdsFn(runtime);
	const itemQuantityIssues = yield* checkRuntimeItemQuantitiesFx(runtime);
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
			...itemUnitIssues,
			...itemIdIssues,
			...itemQuantityIssues,
			...checkRuntimeItemSchedulesFn(runtime),
			...defaultLineIssues,
			...inputLocationIssues,
			...deliveryIssues,
			...jobIssues,
			...locationIssues,
		],
	} satisfies RuntimeCheckResultSchema.Type;
});
