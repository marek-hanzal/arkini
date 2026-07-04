import type { GameConfig } from "~/config/GameConfigTypes";
import type { NearbyLineEffect, RuntimeItemSelector } from "~/effects/RuntimeLineEffectTypes";

const readItemName = ({ config, itemId }: { config: GameConfig; itemId: string }) =>
	config.items[itemId]?.name ?? itemId;

const readSelectorClauseIds = (
	clause:
		| {
				id: string;
		  }
		| {
				ids: string[];
		  }
		| {
				tag: string;
		  },
) => {
	if ("ids" in clause) return clause.ids;
	if ("id" in clause)
		return [
			clause.id,
		];
	return [];
};

const readSelectorPositiveIds = (selector: RuntimeItemSelector) => {
	if ("mode" in selector) return [];

	const ids = new Set<string>();
	for (const clause of selector.anyOf ?? []) {
		for (const id of readSelectorClauseIds(clause)) ids.add(id);
	}
	for (const clause of selector.allOf ?? []) {
		for (const id of readSelectorClauseIds(clause)) ids.add(id);
	}

	return [
		...ids,
	];
};

const formatList = (values: readonly string[]) => {
	if (values.length === 0) return "matching item";
	if (values.length === 1) return values[0] ?? "matching item";
	return `${values.slice(0, -1).join(", ")} or ${values[values.length - 1]}`;
};

export const readNearbyItemSelectorLabel = ({
	config,
	selector,
}: {
	config: GameConfig;
	selector: RuntimeItemSelector;
}) =>
	formatList(
		readSelectorPositiveIds(selector).map((itemId) =>
			readItemName({
				config,
				itemId,
			}),
		),
	);

export const readNearbyLineEffectLabel = ({
	config,
	lineEffect,
}: {
	config: GameConfig;
	lineEffect: NearbyLineEffect;
}) => {
	const itemLabel = readNearbyItemSelectorLabel({
		config,
		selector: lineEffect.items as RuntimeItemSelector,
	});
	if (lineEffect.kind === "nearby.duration.multiply") {
		return `Nearby ${itemLabel} enables production`;
	}
	if (lineEffect.kind === "nearby.capacity.spend") {
		return `Consumes nearby ${itemLabel} capacity`;
	}
	return `Nearby ${itemLabel}`;
};
