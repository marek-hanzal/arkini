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
		pending: boolean;
		onStart(): void;
		onWithdrawInput(itemId: string): void;
	}
}

export const ItemCraftCard: FC<ItemCraftCard.Props> = ({
	craft,
	items,
	pending,
	onStart,
	onWithdrawInput,
}) => {
	const canStart =
		craft.phase === "collecting_inputs" && craft.inputProgress >= 1 && !craft.complete;

	return (
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
				<p className="mt-1 text-xs text-slate-400">
					Build time: {formatMs(craft.durationMs)}
				</p>
			) : null}
			<div className="mt-3 space-y-2">
				{craft.inputs.map((input) => {
					const delivered = craft.delivered[input.itemId] ?? 0;
					const canWithdraw = craft.phase === "collecting_inputs" && delivered > 0;
					return (
						<div
							key={input.itemId}
							className="flex items-center justify-between gap-2 rounded-sm bg-slate-950/45 px-2 py-1.5 text-xs"
						>
							<span>{items[input.itemId]?.name ?? input.itemId}</span>
							<span
								className={cn(
									delivered >= input.quantity
										? "text-emerald-200"
										: "text-slate-400",
								)}
							>
								{delivered}/{input.quantity}
							</span>
							{canWithdraw ? (
								<button
									type="button"
									disabled={pending}
									onClick={() => onWithdrawInput(input.itemId)}
									className="shrink-0 rounded-sm border border-slate-600/70 px-1.5 py-0.5 font-bold text-slate-300 transition hover:border-slate-400/80 hover:text-slate-100 disabled:opacity-35"
								>
									Withdraw
								</button>
							) : null}
						</div>
					);
				})}
			</div>
			<button
				type="button"
				disabled={!canStart || pending}
				onClick={onStart}
				className={cn(
					"mt-3 w-full rounded-sm px-2 py-1.5 text-xs font-black transition disabled:opacity-35",
					canStart
						? "bg-emerald-300 text-slate-950 active:scale-[0.99]"
						: "bg-slate-800 text-slate-500",
				)}
			>
				{craft.phase !== "collecting_inputs"
					? "Running"
					: canStart
						? "Start craft"
						: "Drag inputs in"}
			</button>
		</div>
	);
};
