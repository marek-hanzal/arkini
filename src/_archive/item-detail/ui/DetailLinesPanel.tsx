import { Fragment, type FC, useState } from "react";
import type { ItemCatalogView } from "~/item/view/ItemCatalogViewSchema";
import type { DetailLineModel } from "~/item-detail/control/DetailLineModel";
import { DetailCard, DetailSeparator, DetailTabs } from "~/item-detail/ui/DetailCard";
import { DetailLineCard } from "~/item-detail/ui/DetailLineCard";
import { readDetailLineGroups } from "~/item-detail/ui/readDetailLineGroups";

export namespace DetailLinesPanel {
	export interface Props {
		items: ItemCatalogView;
		lines: readonly DetailLineModel[];
	}
}

export const DetailLinesPanel: FC<DetailLinesPanel.Props> = ({ items, lines }) => {
	const groups = readDetailLineGroups(lines);
	const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.id ?? "product");
	const activeGroup = groups.find((group) => group.id === selectedGroupId) ?? groups[0];

	if (!activeGroup) return null;

	return (
		<DetailCard
			eyebrow="Lines"
			title={activeGroup.title}
		>
			{groups.length > 1 ? (
				<DetailTabs
					items={groups.map((group) => ({
						id: group.id,
						label: group.label,
					}))}
					selectedId={activeGroup.id}
					onSelect={setSelectedGroupId}
				/>
			) : null}
			<div className="mt-3 flex flex-col gap-4">
				{activeGroup.lines.map((model, index) => (
					<Fragment key={model.line.lineId}>
						{index > 0 ? <DetailSeparator className="my-1.5" /> : null}
						<DetailLineCard
							items={items}
							model={model}
						/>
					</Fragment>
				))}
			</div>
		</DetailCard>
	);
};
