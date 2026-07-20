import { useCallback } from "react";

import { useRuntimeSelector } from "~/bridge/runtime/useRuntimeSelector";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readTileEffects } from "~/engine/tile/read/readTileEffects";
import type { SelectorSchema } from "~/engine/selector/schema/SelectorSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace useTileEffects {
	export interface EffectCondition {
		readonly relationId: string;
		readonly ownerItemId: IdSchema.Type;
		readonly ownerTitle: string;
		readonly lineId: IdSchema.Type;
		readonly lineTitle: string;
		readonly ruleType: readTileEffects.EffectCondition["ruleType"];
		readonly multiplier?: number;
		readonly conditionType: readTileEffects.EffectCondition["conditionType"];
		readonly queryScope: readTileEffects.EffectCondition["queryScope"];
		readonly queryDistance?: readTileEffects.EffectCondition["queryDistance"];
		readonly selector: SelectorSchema.Type;
		readonly active: boolean;
		readonly matchedQuantity: number;
		readonly matchedItems: readonly {
			readonly itemId: IdSchema.Type;
			readonly title: string;
			readonly quantity: number;
		}[];
		readonly requiredCount?: number;
		readonly minimumCount?: number;
		readonly maximumCount?: number;
	}

	export type Projection =
		| {
				readonly kind: "available";
				readonly itemId: IdSchema.Type;
				readonly incoming: readonly EffectCondition[];
				readonly outgoing: readonly EffectCondition[];
		  }
		| {
				readonly kind: "unavailable";
		  };
}

const unavailable = {
	kind: "unavailable",
} as const satisfies useTileEffects.Projection;

const sameSelector = (left: SelectorSchema.Type, right: SelectorSchema.Type) =>
	left.type === right.type &&
	(left.type === "item"
		? left.itemId ===
			(
				right as Extract<
					SelectorSchema.Type,
					{
						type: "item";
					}
				>
			).itemId
		: left.tag ===
			(
				right as Extract<
					SelectorSchema.Type,
					{
						type: "tag";
					}
				>
			).tag);

const sameMatchedItems = (
	left: useTileEffects.EffectCondition["matchedItems"],
	right: useTileEffects.EffectCondition["matchedItems"],
) =>
	left.length === right.length &&
	left.every(
		(item, index) =>
			item.itemId === right[index]?.itemId &&
			item.title === right[index]?.title &&
			item.quantity === right[index]?.quantity,
	);

const sameConditions = (
	left: readonly useTileEffects.EffectCondition[],
	right: readonly useTileEffects.EffectCondition[],
) =>
	left.length === right.length &&
	left.every((condition, index) => {
		const candidate = right[index];
		return (
			condition.relationId === candidate?.relationId &&
			condition.ownerItemId === candidate.ownerItemId &&
			condition.ownerTitle === candidate.ownerTitle &&
			condition.lineId === candidate.lineId &&
			condition.lineTitle === candidate.lineTitle &&
			condition.ruleType === candidate.ruleType &&
			condition.multiplier === candidate.multiplier &&
			condition.conditionType === candidate.conditionType &&
			condition.queryScope === candidate.queryScope &&
			condition.queryDistance === candidate.queryDistance &&
			sameSelector(condition.selector, candidate.selector) &&
			condition.active === candidate.active &&
			condition.matchedQuantity === candidate.matchedQuantity &&
			sameMatchedItems(condition.matchedItems, candidate.matchedItems) &&
			condition.requiredCount === candidate.requiredCount &&
			condition.minimumCount === candidate.minimumCount &&
			condition.maximumCount === candidate.maximumCount
		);
	});

const sameProjection = (left: useTileEffects.Projection, right: useTileEffects.Projection) => {
	if (left.kind !== right.kind) return false;
	if (left.kind === "unavailable" || right.kind === "unavailable") return true;
	return (
		left.itemId === right.itemId &&
		sameConditions(left.incoming, right.incoming) &&
		sameConditions(left.outgoing, right.outgoing)
	);
};

/** Projects one exact runtime tile's current incoming and outgoing effect conditions. */
export const useTileEffects = (itemId: IdSchema.Type): useTileEffects.Projection => {
	const selector = useCallback(
		(runtime: RuntimeSchema.Type): useTileEffects.Projection => {
			const effects = readTileEffects({
				itemId,
				runtime,
			});
			if (effects.kind === "unavailable") return unavailable;
			return effects;
		},
		[
			itemId,
		],
	);
	return useRuntimeSelector(selector, sameProjection);
};
