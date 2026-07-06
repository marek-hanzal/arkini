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

const readOutputEffectLines = (output: DetailLineOutputView) => [
	...(output.bonusLines ?? []),
	...(output.effects ?? []).map((effect) => `${effect.label}: ${effect.result}`),
];

export const readDetailLineOutputRows = (
	outputs: readonly DetailLineOutputView[],
): readonly DetailLineOutputRowModel.Type[] => {
	const rowsByItemId = new Map<string, DetailLineOutputRowModel.Type>();
	const rows: DetailLineOutputRowModel.Type[] = [];

	for (const output of outputs) {
		const existing = rowsByItemId.get(output.itemId);
		const effectLines = readOutputEffectLines(output);

		if (!existing) {
			const created: DetailLineOutputRowModel.Type = {
				effectLines: [
					...effectLines,
				],
				itemId: output.itemId,
				metaBadges: [
					{
						label: readOutputMetaLabel(output),
						one: output.enabled === false ? "warn" : undefined,
					},
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
