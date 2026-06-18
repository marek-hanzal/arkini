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
		<div
			data-ui="craft requirements"
			className="rounded-sm border border-ak-border bg-ak-surface-soft p-3"
		>
			<div className="flex items-center justify-between gap-3">
				<p className="text-[0.66rem] font-extrabold uppercase tracking-[0.16em] text-ak-primary">
					Craft progress
				</p>
				<p className="text-xs font-semibold text-emerald-700">
					{craftStatusLabel({
						craft,
					})}
				</p>
			</div>
			<div className="mt-2 h-2 overflow-hidden rounded-sm bg-ak-surface">
				<div
					className="h-full rounded-sm bg-emerald-500 transition-[width] duration-200 ease-linear"
					style={{
						width: `${Math.round(craft.progress * 100)}%`,
					}}
				/>
			</div>
			<p className="text-ak-text-muted mt-3 text-xs">
				Creates{" "}
				<strong className="text-ak-text">
					{items[craft.resultItemId]?.name ?? craft.resultItemId}
				</strong>
			</p>
			{craft.durationMs > 0 ? (
				<p className="text-ak-text-muted mt-1 text-xs">
					Build time: {formatMs(craft.durationMs)}
				</p>
			) : null}
			<div className="mt-3 grid gap-2">
				{craft.inputs.map((input) => {
					const delivered = craft.delivered[input.itemId] ?? 0;
					const canWithdraw = craft.phase === "collecting_inputs" && delivered > 0;
					return (
						<div
							key={input.itemId}
							className="flex min-w-0 items-center justify-between gap-2 rounded-sm bg-ak-surface px-2 py-2 text-xs"
						>
							<span className="min-w-0 truncate font-semibold">
								{items[input.itemId]?.name ?? input.itemId}
							</span>
							<span
								className={cn(
									"shrink-0 tabular-nums",
									delivered >= input.quantity
										? "font-bold text-emerald-700"
										: "text-ak-text-muted",
								)}
							>
								{delivered}/{input.quantity}
							</span>
							{canWithdraw ? (
								<button
									type="button"
									data-ui="withdraw action"
									disabled={pending}
									onClick={() => onWithdrawInput(input.itemId)}
									className="min-h-10 shrink-0 rounded-sm border border-ak-border bg-ak-surface px-3 py-2 text-xs font-extrabold leading-none text-ak-text transition-[transform,border-color,background,color,opacity] hover:border-ak-border-accent hover:bg-ak-surface-soft active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45"
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
					"mt-3 min-h-10 w-full rounded-sm border px-3 py-2 text-xs font-extrabold leading-none transition-[transform,border-color,background,color,opacity] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45",
					canStart
						? "border-ak-border-accent bg-ak-primary text-white hover:bg-pink-400"
						: "border-ak-border bg-ak-surface text-ak-text hover:border-ak-border-accent hover:bg-ak-surface-soft",
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
