import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import { checkGeneratedSpacesFn } from "~/space/fn/checkGeneratedSpacesFn";
import { checkRuntimeItemSchedulesFn } from "~/item-schedule/fn/checkRuntimeItemSchedulesFn";
import { Effect } from "effect";

import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { DuplicateItemIdIssueSchema } from "~/game-runtime/schema/DuplicateItemIdIssueSchema";
import { ItemUnitsIssueReasonEnumSchema } from "~/game-runtime/schema/ItemUnitsIssueReasonEnumSchema";
import type { ItemUnitsIssueSchema } from "~/game-runtime/schema/ItemUnitsIssueSchema";
import type { LocationOccupiedIssueSchema } from "~/game-runtime/schema/LocationOccupiedIssueSchema";
import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/RuntimeCheckIssueEnumSchema";
import type { RuntimeCheckResultSchema } from "~/game-runtime/schema/RuntimeCheckResultSchema";
import { indexGridLocationClaimsFn } from "~/item-location/fn/indexGridLocationClaimsFn";
import { readGridLocationClaimsFn } from "~/item-location/fn/readGridLocationClaimsFn";
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

/** Existing saved coordinates need not fit the current authored dimensions; occupancy remains invariant. */
const checkRuntimeLocationsFn = (runtime: RuntimeSchema.Type) => {
	const occupancyIssues: LocationOccupiedIssueSchema.Type[] = [];
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

	return occupancyIssues;
};

/** Runs every explicit invariant checker against one candidate runtime. */
export const checkRuntimeFx = Effect.fn("checkRuntimeFx")(function* ({
	runtime,
}: CheckRuntimeProps) {
	const config = yield* GameConfigFx;
	const itemUnitIssues = checkRuntimeItemUnitsFn(runtime);
	const itemIdIssues = checkRuntimeItemIdsFn(runtime);
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
	const locationIssues = checkRuntimeLocationsFn(runtime);

	return {
		issues: [
			...checkGeneratedSpacesFn({
				runtime,
				config,
			}),
			...itemUnitIssues,
			...itemIdIssues,
			...checkRuntimeItemSchedulesFn(runtime),
			...defaultLineIssues,
			...inputLocationIssues,
			...deliveryIssues,
			...jobIssues,
			...locationIssues,
		],
	} satisfies RuntimeCheckResultSchema.Type;
});
