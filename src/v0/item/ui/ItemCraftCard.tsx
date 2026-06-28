import type { FC } from "react";
import type { CraftProgressView } from "~/v0/board/view/CraftProgressViewSchema";
import { craftStatusLabel } from "~/v0/item/logic/craftStatusLabel";
import { ItemInlineAsset } from "~/v0/item/ui/ItemInlineAsset";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import { formatMs } from "~/v0/time/formatMs";
import { UiButton } from "~/v0/ui/UiButton";
import { cn } from "~/v0/ui/cn";
import { UiSection } from "~/v0/ui/UiSection";

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
	const resultItem = items[craft.resultItemId];

	return (
		<UiSection
			className=""
			eyebrow="Craft"
			title={resultItem?.name ?? craft.resultItemId}
			action={
				<span className="text-sm font-bold text-ak-primary">
					{craftStatusLabel({
						craft,
					})}
				</span>
			}
		>
			<div className="flex items-start gap-3">
				<ItemInlineAsset
					item={resultItem}
					className="h-12 w-12"
				/>
				<div className="min-w-0 flex-1">
					<div className="h-2 overflow-hidden rounded-sm bg-ak-surface-soft">
						<div
							className="h-full rounded-sm bg-emerald-500 transition-[width] duration-200 ease-linear"
							style={{
								width: `${Math.round(craft.progress * 100)}%`,
							}}
						/>
					</div>
					<div className="mt-3 space-y-1 text-sm text-ak-text-muted">
						<p>
							Creates{" "}
							<strong className="text-ak-text">
								{resultItem?.name ?? craft.resultItemId}
							</strong>
						</p>
						{craft.durationMs > 0 ? (
							<p>Build time: {formatMs(craft.durationMs)}</p>
						) : null}
					</div>
				</div>
			</div>
			<div className="mt-3 grid gap-2">
				{craft.inputs.map((input) => {
					const delivered = craft.delivered[input.itemId] ?? 0;
					const canWithdraw = craft.phase === "collecting_inputs" && delivered > 0;
					const inputItem = items[input.itemId];
					return (
						<div
							key={input.itemId}
							className="flex min-w-0 items-center gap-2 rounded-sm bg-ak-surface px-2.5 py-2 text-sm"
						>
							<ItemInlineAsset
								item={inputItem}
								className="h-9 w-9"
							/>
							<div className="min-w-0 flex-1">
								<p className="break-words font-semibold text-ak-text">
									{inputItem?.name ?? input.itemId}
								</p>
								<p
									className={cn(
										"mt-0.5 text-xs leading-5",
										delivered >= input.quantity
											? "font-bold text-emerald-300"
											: "text-ak-text-muted",
									)}
								>
									{delivered}/{input.quantity}
									{delivered < input.quantity && input.available
										? ` · +${Math.min(input.quantity - delivered, input.available)} available`
										: ""}
								</p>
							</div>
							{canWithdraw ? (
								<UiButton
									data-ui="withdraw action"
									disabled={pending}
									fullWidth={false}
									onClick={() => onWithdrawInput(input.itemId)}
								>
									Withdraw
								</UiButton>
							) : null}
						</div>
					);
				})}
			</div>
			<UiButton
				disabled={!canStart || pending}
				tone={canStart ? "primary" : "secondary"}
				className="mt-3"
				onClick={onStart}
			>
				{craft.phase === "paused"
					? "Paused"
					: craft.phase === "delivery_blocked"
						? "Delivery blocked"
						: craft.phase !== "collecting_inputs"
							? "Running"
							: canStart
								? "Start craft"
								: "Auto-fill or drag inputs"}
			</UiButton>
		</UiSection>
	);
};
