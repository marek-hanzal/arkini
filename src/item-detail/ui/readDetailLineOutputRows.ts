import type { LineView } from "~/board/view/LineViewSchema";
import { joinTextParts } from "~/ui/joinTextParts";
import { formatDetailLinePercent } from "~/item-detail/ui/formatDetailLinePercent";

type DetailLineOutputView = NonNullable<LineView["outputs"]>[number];

export namespace DetailLineOutputRowModel {
	export interface MetaBadge {
		label: string;
		one?: "owned" | "warn";
	}

	export interface Type {
		effectLines: string[];
		effectBadges: MetaBadge[];
		itemId: string;
		metaBadges: MetaBadge[];
		ownedQuantity: number;
	}
}

const readQuantityLabel = (quantity: DetailLineOutputView["quantity"]) => {
	const resolvedQuantity = quantity ?? 1;
	return typeof resolvedQuantity === "number"
		? `${resolvedQuantity}×`
		: `${resolvedQuantity.min}-${resolvedQuantity.max}×`;
};

const readOutputProbabilityLabel = (output: DetailLineOutputView) => {
	if (output.probability === undefined) {
		return output.kind === "guaranteed" ? "guaranteed" : undefined;
	}

	return output.kind === "weighted"
		? `${formatDetailLinePercent(output.probability)}/roll`
		: `${formatDetailLinePercent(output.probability)} chance`;
};

const readOutputMetaLabel = (output: DetailLineOutputView) =>
	joinTextParts([
		output.enabled === false ? "disabled" : undefined,
		readQuantityLabel(output.quantity),
		readOutputProbabilityLabel(output),
		output.rollLabel,
	]);

const readActiveOutputEffectLabels = (output: DetailLineOutputView) =>
	(output.effects ?? [])
		.filter((effect) => effect.active && effect.result !== "inactive")
		.map((effect) => `${effect.label}: ${effect.result}`);

const readOutputEffectLabels = (output: DetailLineOutputView) => [
	...(output.bonusLines ?? []),
	...readActiveOutputEffectLabels(output),
];

export const readDetailLineOutputRows = (
	outputs: readonly DetailLineOutputView[],
): readonly DetailLineOutputRowModel.Type[] => {
	const rowsByItemId = new Map<string, DetailLineOutputRowModel.Type>();
	const rows: DetailLineOutputRowModel.Type[] = [];

	for (const output of outputs) {
		const existing = rowsByItemId.get(output.itemId);
		const effectLines = readOutputEffectLabels(output);
		const effectBadges = effectLines.map((label) => ({
			label,
		}));

		if (!existing) {
			const created: DetailLineOutputRowModel.Type = {
				effectBadges: [
					...effectBadges,
				],
				effectLines: [
					...effectLines,
				],
				itemId: output.itemId,
				metaBadges: [
					{
						label: readOutputMetaLabel(output),
						one: output.enabled === false ? "warn" : undefined,
					},
					...effectBadges,
					{
						label: `Owned ${output.ownedQuantity}`,
						one: "owned",
					},
				],
				ownedQuantity: output.ownedQuantity,
			};
			rowsByItemId.set(output.itemId, created);
			rows.push(created);
			continue;
		}

		existing.ownedQuantity = output.ownedQuantity;
		existing.metaBadges.splice(existing.metaBadges.length - 1, 0, {
			label: readOutputMetaLabel(output),
			one: output.enabled === false ? "warn" : undefined,
		});

		for (const effectBadge of effectBadges) {
			if (existing.effectBadges.some((badge) => badge.label === effectBadge.label)) continue;
			existing.effectBadges.push(effectBadge);
			existing.metaBadges.splice(existing.metaBadges.length - 1, 0, effectBadge);
		}

		for (const effectLine of effectLines) {
			if (existing.effectLines.includes(effectLine)) continue;
			existing.effectLines.push(effectLine);
		}

		const ownedBadge = existing.metaBadges[existing.metaBadges.length - 1];
		if (ownedBadge?.one === "owned") {
			ownedBadge.label = `Owned ${output.ownedQuantity}`;
		}
	}

	return rows;
};

export type DetailLineOutputRow = DetailLineOutputRowModel.Type;
export type DetailLineOutputMetaBadge = DetailLineOutputRowModel.MetaBadge;
