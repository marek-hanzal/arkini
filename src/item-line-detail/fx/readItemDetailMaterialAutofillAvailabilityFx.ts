import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import { readItemDetailSourcesFx } from "~/engine/item-detail/read/readItemDetailSourcesFx";
import { isMaterialInputEligibleFn } from "~/production-input/read/fn/isMaterialInputEligibleFn";
import { isLineInputAutofillSourceLocationFn } from "~/production-input/read/isLineInputAutofillSourceLocationFn";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { matchesItemSelectorFn } from "~/item-definition/fn/matchesItemSelectorFn";
import type { SelectorSchema } from "~/item-definition/schema/SelectorSchema";

interface MaterialAutofillAvailability {
	readonly availableQuantity: number;
	readonly producerItemId?: IdSchema.Type;
}

/**
 * Reads uncommitted material quantity visible to autofill and one direct production shortcut.
 *
 * A delivery retains the whole physical source stack even when only part of it is claimed. Its
 * unclaimed remainder therefore stays available in this projection while the claimed cargo is
 * represented separately by the target input's delivery quantity. Returning cargo has no live
 * claim, so all of it remains visible. The producer shortcut reuses the visibility-aware Sources
 * projection and then follows runtime order to keep selection stable.
 */
export const readItemDetailMaterialAutofillAvailabilityFx = Effect.fn(
	"readItemDetailMaterialAutofillAvailabilityFx",
)(function* ({
	ownerItemId,
	runtime,
	selector,
}: {
	readonly ownerItemId: IdSchema.Type;
	readonly runtime: RuntimeSchema.Type;
	readonly selector: SelectorSchema.Type;
}) {
	const owner = runtime.items.find((candidate) => candidate.id === ownerItemId);
	const space =
		owner?.location.scope === LocationScopeEnumSchema.enum.Board
			? owner.location.space
			: runtime.currentSpace;
	const activeJobOwnerItemIds = new Set(runtime.jobs.map((job) => job.ownerItemId));
	let availableQuantity = 0;
	for (const candidate of runtime.items) {
		if (
			candidate.id === ownerItemId ||
			activeJobOwnerItemIds.has(candidate.id) ||
			!isMaterialInputEligibleFn(candidate.item) ||
			!matchesItemSelectorFn({
				item: candidate.item,
				selector,
			})
		) {
			continue;
		}

		if (candidate.location.scope === LocationScopeEnumSchema.enum.Delivery) {
			if (
				!isLineInputAutofillSourceLocationFn({
					location: candidate.location.origin,
					ownerSpace: space,
				})
			) {
				continue;
			}
			if (candidate.location.phase === "returning") {
				availableQuantity += candidate.quantity;
				continue;
			}
			const claimedQuantity = candidate.location.target.input.reduce(
				(quantity, allocation) => quantity + allocation.quantity,
				0,
			);
			availableQuantity += Math.max(0, candidate.quantity - claimedQuantity);
			continue;
		}

		if (
			(candidate.location.scope !== LocationScopeEnumSchema.enum.Board &&
				candidate.location.scope !== LocationScopeEnumSchema.enum.Inventory &&
				candidate.location.scope !== LocationScopeEnumSchema.enum.Toolbar) ||
			!isLineInputAutofillSourceLocationFn({
				location: candidate.location,
				ownerSpace: space,
			})
		) {
			continue;
		}
		availableQuantity += candidate.quantity;
	}

	if (availableQuantity > 0) {
		return {
			availableQuantity,
		} satisfies MaterialAutofillAvailability;
	}

	const config = yield* GameConfigFx;
	const matchingDefinitionIds: IdSchema.Type[] = [];
	for (const item of Object.values(config.items)) {
		if (
			isMaterialInputEligibleFn(item) &&
			matchesItemSelectorFn({
				item,
				selector,
			})
		) {
			matchingDefinitionIds.push(item.id);
		}
	}
	const producerItemIds = new Set<IdSchema.Type>();
	for (const itemId of matchingDefinitionIds) {
		const sources = yield* readItemDetailSourcesFx({
			runtime,
			target: {
				kind: "definition",
				itemId,
			},
		});
		if (sources.kind !== "available" || sources.targetDefinitionItemId !== itemId) continue;
		for (const source of sources.source) {
			if (source.space === space) producerItemIds.add(source.ownerItemId);
		}
	}
	const producer = runtime.items.find(
		(candidate) =>
			candidate.location.scope === LocationScopeEnumSchema.enum.Board &&
			candidate.location.space === space &&
			producerItemIds.has(candidate.id),
	);
	return {
		availableQuantity,
		...(producer === undefined
			? {}
			: {
					producerItemId: producer.id,
				}),
	} satisfies MaterialAutofillAvailability;
});
