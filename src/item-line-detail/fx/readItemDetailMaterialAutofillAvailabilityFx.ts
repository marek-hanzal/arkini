import { Effect, Option } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import { readItemDetailSourcesFx } from "~/item-detail-read/fx/readItemDetailSourcesFx";
import { matchesQueryLocationFn } from "~/item-query/fn/matchesQueryLocationFn";
import { narrowBoardRuntimeItemFn } from "~/game-runtime/fn/narrowBoardRuntimeItemFn";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { matchesItemSelectorFn } from "~/item-definition/fn/matchesItemSelectorFn";
import type { QuerySchema } from "~/item-query/schema/QuerySchema";

interface MaterialAutofillAvailability {
	readonly availableQuantity: number;
	readonly producerItemId?: IdSchema.Type;
}

/** Counts available individual materials, including returning deliveries, and resolves a producer shortcut. */
export const readItemDetailMaterialAutofillAvailabilityFx = Effect.fn(
	"readItemDetailMaterialAutofillAvailabilityFx",
)(function* ({
	ownerItemId,
	runtime,
	query,
}: {
	readonly ownerItemId: IdSchema.Type;
	readonly runtime: RuntimeSchema.Type;
	readonly query: QuerySchema.Type;
}) {
	const owner = runtime.items.find((candidate) => candidate.id === ownerItemId);
	const origin =
		owner === undefined
			? undefined
			: Option.getOrUndefined(narrowBoardRuntimeItemFn(owner))?.location;
	const selector = query.selector;
	const space =
		owner?.location.scope === LocationScopeEnumSchema.enum.Board
			? owner.location.space
			: runtime.currentSpace;
	const busyOwnerItemIds = new Set([
		...runtime.jobs.map((job) => job.ownerItemId),
		...runtime.jobQueue.map((request) => request.ownerItemId),
	]);
	let availableQuantity = 0;
	for (const candidate of runtime.items) {
		if (
			candidate.id === ownerItemId ||
			busyOwnerItemIds.has(candidate.id) ||
			!matchesItemSelectorFn({
				item: candidate.item,
				selector,
			})
		) {
			continue;
		}

		if (candidate.location.scope === LocationScopeEnumSchema.enum.Delivery) {
			if (
				!matchesQueryLocationFn({
					location: candidate.location.origin,
					origin,
					query,
				})
			) {
				continue;
			}
			if (candidate.location.phase === "returning") {
				availableQuantity += 1;
				continue;
			}
			continue;
		}

		if (
			candidate.location.scope !== LocationScopeEnumSchema.enum.Board ||
			!matchesQueryLocationFn({
				location: candidate.location,
				origin,
				query,
			})
		) {
			continue;
		}
		availableQuantity += 1;
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
