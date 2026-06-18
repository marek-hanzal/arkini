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
			className="ak-ui-card-soft p-3"
		>
			<div className="flex items-center justify-between gap-3">
				<p className="ak-ui-eyebrow">Craft progress</p>
				<p className="text-xs font-semibold text-emerald-700">
					{craftStatusLabel({
						craft,
					})}
				</p>
			</div>
			<div className="ak-ui-progress-track mt-2">
				<div
					className="ak-ui-progress-success"
					style={{
						width: `${Math.round(craft.progress * 100)}%`,
					}}
				/>
			</div>
			<p className="ak-ui-muted mt-3 text-xs">
				Creates{" "}
				<strong className="text-ak-text">
					{items[craft.resultItemId]?.name ?? craft.resultItemId}
				</strong>
			</p>
			{craft.durationMs > 0 ? (
				<p className="ak-ui-muted mt-1 text-xs">Build time: {formatMs(craft.durationMs)}</p>
			) : null}
			<div className="mt-3 grid gap-2">
				{craft.inputs.map((input) => {
					const delivered = craft.delivered[input.itemId] ?? 0;
					const canWithdraw = craft.phase === "collecting_inputs" && delivered > 0;
					return (
						<div
							key={input.itemId}
							className="ak-ui-row flex min-w-0 items-center justify-between gap-2 px-2 py-2 text-xs"
						>
							<span className="min-w-0 truncate font-semibold">
								{items[input.itemId]?.name ?? input.itemId}
							</span>
							<span
								className={cn(
									"shrink-0 tabular-nums",
									delivered >= input.quantity
										? "font-bold text-emerald-700"
										: "ak-ui-muted",
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
									className="ak-ui-button ak-ui-button-secondary min-h-10 shrink-0 px-3 text-xs"
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
					"ak-ui-button mt-3 w-full",
					canStart ? "ak-ui-button-primary" : "ak-ui-button-ghost",
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
