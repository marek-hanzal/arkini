import type { FC } from "react";
import { craftStatusLabel } from "~/v0/item/logic/craftStatusLabel";
import type { CraftProgressView } from "~/v0/board/view/CraftProgressViewSchema";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import { cn } from "~/v0/ui/cn";
import { formatMs } from "~/v0/time/formatMs";

export namespace ItemCraftCard {
	export interface Props {
		craft: CraftProgressView;
		items: ItemCatalogView;
	}
}

export const ItemCraftCard: FC<ItemCraftCard.Props> = ({ craft, items }) => (
	<div className="rounded-md border border-emerald-400/20 bg-emerald-950/18 p-3">
		<div className="flex items-center justify-between gap-3">
			<p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
				Craft progress
			</p>
			<p className="text-xs text-emerald-100">
				{craftStatusLabel({
					craft,
				})}
			</p>
		</div>
		<div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-950/80">
			<div
				className="h-full rounded-full bg-emerald-300/70"
				style={{
					width: `${Math.round(craft.progress * 100)}%`,
				}}
			/>
		</div>
		<p className="mt-3 text-xs text-slate-300">
			Creates <strong>{items[craft.resultItemId]?.name ?? craft.resultItemId}</strong>
		</p>
		{craft.durationMs > 0 ? (
			<p className="mt-1 text-xs text-slate-400">Build time: {formatMs(craft.durationMs)}</p>
		) : null}
		<div className="mt-3 space-y-2">
			{craft.inputs.map((input) => {
				const delivered = craft.delivered[input.itemId] ?? 0;
				return (
					<div
						key={input.itemId}
						className="flex items-center justify-between rounded-sm bg-slate-950/45 px-2 py-1.5 text-xs"
					>
						<span>{items[input.itemId]?.name ?? input.itemId}</span>
						<span
							className={cn(
								delivered >= input.quantity ? "text-emerald-200" : "text-slate-400",
							)}
						>
							{delivered}/{input.quantity}
						</span>
					</div>
				);
			})}
		</div>
	</div>
);
