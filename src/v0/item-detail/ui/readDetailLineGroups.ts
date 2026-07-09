import type { DetailLineModel } from "~/item-detail/control/DetailLineModel";
import { effectDetailPolarityTabs } from "~/item-detail/ui/effectDetailPresentation";
import { readDetailLineEffectPolarity } from "~/item-detail/ui/readDetailLineEffectPolarity";

export interface DetailLineGroup {
	id: string;
	label: string;
	lines: readonly DetailLineModel[];
	title: string;
}

export const readDetailLineGroups = (
	lines: readonly DetailLineModel[],
): readonly DetailLineGroup[] =>
	[
		{
			id: "product",
			label: "Products",
			lines: lines.filter(({ line }) => line.kind === "product"),
			title: "Lines",
		},
		...effectDetailPolarityTabs.map((tab) => ({
			id: `effect:${tab.polarity}`,
			label: tab.label,
			lines: lines.filter(
				({ line }) =>
					line.kind === "effect" && readDetailLineEffectPolarity(line) === tab.polarity,
			),
			title: tab.title,
		})),
	].filter((group) => group.lines.length > 0);
