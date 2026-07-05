import type { FC } from "react";
import type { LineView } from "~/board/view/LineViewSchema";
import { ItemInlineAsset } from "~/item/ui/ItemInlineAsset";
import type { ItemCatalogView } from "~/item/view/ItemCatalogViewSchema";
import { readDetailItemName } from "~/item-detail/ui/readDetailItemName";
import { readDetailLineOutputMeta } from "~/item-detail/ui/readDetailLineOutputMeta";
import { cn } from "~/ui/cn";

type DetailLineOutputView = NonNullable<LineView["outputs"]>[number];

const readOutputEffectLines = (output: DetailLineOutputView) =>
	(output.effects ?? []).map((effect) => `${effect.label}: ${effect.result}`);

const DetailOutputEffectLines: FC<{
	lineId: string;
	output: DetailLineOutputView;
	outputIndex: number;
}> = ({ lineId, output, outputIndex }) => {
	const effectLines = readOutputEffectLines(output);
	if (effectLines.length === 0) return null;

	return (
		<ul className="mt-1 space-y-0.5 leading-5 text-ak-text-muted">
			{effectLines.map((effectLine, effectLineIndex) => (
				<li
					key={`${lineId}:output:${outputIndex}:effect:${effectLineIndex}`}
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
	line: LineView;
}> = ({ items, line }) => {
	const outputs = line.outputs ?? [];
	if (outputs.length === 0) return null;

	return (
		<div className="rounded-sm bg-ak-surface/80 px-2.5 py-2 text-xs">
			<p className="font-black text-ak-text">Outputs</p>
			<div className="mt-1.5 grid gap-1.5">
				{outputs.map((output, outputIndex) => {
					const outputItem = items[output.itemId];
					return (
						<div
							key={`${line.lineId}:output:${output.itemId}:${outputIndex}`}
							className="flex min-w-0 items-center gap-2"
						>
							<ItemInlineAsset
								item={outputItem}
								className="h-9 w-9"
							/>
							<div className="min-w-0 flex-1">
								<p className="break-words font-black text-ak-text">
									{outputItem?.name ??
										readDetailItemName({
											itemId: output.itemId,
											items,
										})}
								</p>
								<p
									className={cn(
										"mt-0.5 break-words leading-5",
										output.enabled === false
											? "text-rose-200"
											: "text-ak-text-muted",
									)}
								>
									{readDetailLineOutputMeta(output)}
								</p>
								<DetailOutputEffectLines
									lineId={line.lineId}
									output={output}
									outputIndex={outputIndex}
								/>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
};
