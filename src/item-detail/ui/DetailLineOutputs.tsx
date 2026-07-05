import type { FC } from "react";
import type { LineView } from "~/board/view/LineViewSchema";
import type { ItemCatalogView } from "~/item/view/ItemCatalogViewSchema";
import { ItemInlineAsset } from "~/item/ui/ItemInlineAsset";
import { readDetailItemName } from "~/item-detail/ui/readDetailItemName";
import {
	readDetailLineOutputRows,
	type DetailLineOutputMetaBadge,
} from "~/item-detail/ui/readDetailLineOutputRows";
import { cn } from "~/ui/cn";

const DetailOutputMetaBadge: FC<{
	badge: DetailLineOutputMetaBadge;
}> = ({ badge }) => (
	<span
		className={cn(
			"rounded-full border px-2 py-1 text-[0.68rem] font-black leading-none shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]",
			badge.one === "owned"
				? "border-fuchsia-300/40 bg-fuchsia-300/16 text-fuchsia-50"
				: badge.one === "warn"
					? "border-rose-300/35 bg-rose-300/14 text-rose-100"
					: "border-violet-200/20 bg-white/8 text-violet-50",
		)}
	>
		{badge.label}
	</span>
);

const DetailOutputEffectLines: FC<{
	effectLines: readonly string[];
}> = ({ effectLines }) => {
	if (effectLines.length === 0) return null;

	return (
		<ul className="mt-1.5 space-y-0.5 text-[0.72rem] leading-5 text-violet-100/78">
			{effectLines.map((effectLine, effectLineIndex) => (
				<li
					key={`effect:${effectLineIndex}:${effectLine}`}
					className="break-words"
				>
					{effectLine}
				</li>
			))}
		</ul>
	);
};

export const DetailLineOutputs: FC<{
	items: ItemCatalogView;
	line: Pick<LineView, "lineId" | "outputs">;
}> = ({ items, line }) => {
	const outputs = line.outputs ?? [];
	if (outputs.length === 0) return null;

	const rows = readDetailLineOutputRows(outputs);

	return (
		<div className="rounded-sm bg-ak-surface/80 px-2.5 py-2 text-xs">
			<p className="font-black text-ak-text">Outputs</p>
			<div className="mt-2 grid gap-2">
				{rows.map((row) => {
					const outputItem = items[row.itemId];
					return (
						<div
							key={`${line.lineId}:output:${row.itemId}`}
							className="flex min-w-0 items-start gap-2.5 rounded-sm border border-violet-300/14 bg-black/10 px-2 py-2"
						>
							<ItemInlineAsset
								item={outputItem}
								className="h-10 w-10 shrink-0"
							/>
							<div className="min-w-0 flex-1">
								<p className="break-words font-black text-ak-text">
									{outputItem?.name ??
										readDetailItemName({
											itemId: row.itemId,
											items,
										})}
								</p>
								<div className="mt-1 flex flex-wrap gap-1.5">
									{row.metaBadges.map((badge, badgeIndex) => (
										<DetailOutputMetaBadge
											key={`${row.itemId}:badge:${badgeIndex}:${badge.label}`}
											badge={badge}
										/>
									))}
								</div>
								<DetailOutputEffectLines effectLines={row.effectLines} />
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
};
