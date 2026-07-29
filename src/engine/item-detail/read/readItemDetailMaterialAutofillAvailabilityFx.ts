import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import { readItemDetailSourcesFx } from "~/engine/item-detail/read/readItemDetailSourcesFx";
import { isMaterialInputEligible } from "~/engine/input/read/readMaterialInputEligibilityFx";
import { isLineInputAutofillSourceLocation } from "~/engine/input/read/isLineInputAutofillSourceLocation";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { matchesItemSelector } from "~/engine/selector/fx/selectItemsFx";
import type { SelectorSchema } from "~/engine/selector/schema/SelectorSchema";

export namespace readItemDetailMaterialAutofillAvailabilityFx {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
		readonly selector: SelectorSchema.Type;
	}

	export interface Result {
		readonly availableQuantity: number;
		readonly producerItemId?: IdSchema.Type;
	}
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
}: readItemDetailMaterialAutofillAvailabilityFx.Props) {
	const owner = runtime.items.find((candidate) => candidate.id === ownerItemId);
	const space =
		owner?.location.scope === LocationScopeEnumSchema.enum.Board
			? owner.location.space
			: runtime.currentSpace;
	const activeJobOwnerItemIds = new Set(runtime.jobs.map((job) => job.ownerItemId));
	const availableQuantity = runtime.items.reduce((total, candidate) => {
		if (
			candidate.id === ownerItemId ||
			activeJobOwnerItemIds.has(candidate.id) ||
			!isMaterialInputEligible(candidate.item) ||
			!matchesItemSelector({
				item: candidate.item,
				selector,
			})
		) {
			return total;
		}

		if (candidate.location.scope === LocationScopeEnumSchema.enum.Delivery) {
			if (
				!isLineInputAutofillSourceLocation({
					location: candidate.location.origin,
					ownerSpace: space,
				})
			) {
				return total;
			}
			if (candidate.location.phase === "returning") {
				return total + candidate.quantity;
			}
			const claimedQuantity = candidate.location.target.input.reduce(
				(quantity, allocation) => quantity + allocation.quantity,
				0,
			);
			return total + Math.max(0, candidate.quantity - claimedQuantity);
		}

		if (
			(candidate.location.scope !== LocationScopeEnumSchema.enum.Board &&
				candidate.location.scope !== LocationScopeEnumSchema.enum.Inventory &&
				candidate.location.scope !== LocationScopeEnumSchema.enum.Toolbar) ||
			!isLineInputAutofillSourceLocation({
				location: candidate.location,
				ownerSpace: space,
			})
		) {
			return total;
		}
		return total + candidate.quantity;
	}, 0);

	if (availableQuantity > 0) {
		return {
			availableQuantity,
		} satisfies readItemDetailMaterialAutofillAvailabilityFx.Result;
	}

	const config = yield* GameConfigFx;
	const matchingDefinitionIds = Object.values(config.items)
		.filter(
			(item) =>
				isMaterialInputEligible(item) &&
				matchesItemSelector({
					item,
					selector,
				}),
		)
		.map((item) => item.id);
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
	} satisfies readItemDetailMaterialAutofillAvailabilityFx.Result;
});
