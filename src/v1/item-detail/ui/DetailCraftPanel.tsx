import type { FC } from "react";
import type { CraftProgressView } from "~/v0/board/view/CraftProgressViewSchema";
import { readCraftRunState } from "~/v0/craft/logic/readCraftRunState";
import { craftStatusLabel } from "~/v0/item/logic/craftStatusLabel";
import { ItemInlineAsset } from "~/v0/item/ui/ItemInlineAsset";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import { formatMs } from "~/v0/time/formatMs";
import { UiButton } from "~/v0/ui/UiButton";
import { cn } from "~/v0/ui/cn";
import { DetailCard, DetailMutedPill } from "~/v1/item-detail/ui/DetailCard";

export namespace DetailCraftPanel {
	export interface Props {
		craft: CraftProgressView;
		items: ItemCatalogView;
		pending: boolean;
		onClaim(): void;
		onStart(): void;
		onWithdrawInput(itemId: string): void;
	}
}

const readTargetLimitLabel = (
	limit: NonNullable<CraftProgressView["targetLimits"]>[number],
	items: ItemCatalogView,
) => {
	const itemName = items[limit.itemId]?.name ?? limit.itemId;
	const baseLabel = `${itemName} ${limit.ownedQuantity}/${limit.maxCount}`;
	return limit.remainingQuantity < limit.requiredQuantity
		? `${baseLabel} · limit reached`
		: baseLabel;
};

export const DetailCraftPanel: FC<DetailCraftPanel.Props> = ({
	craft,
	items,
	onClaim,
	onStart,
	onWithdrawInput,
	pending,
}) => {
	const runState = readCraftRunState({
		craft,
	});
	const resultItem = items[craft.resultItemId];
	const targetLimits = craft.targetLimits ?? [];
	const effectBlockReasons = craft.effectBlockReasons ?? [];

	return (
		<DetailCard
			eyebrow="Craft"
			title={resultItem?.name ?? craft.resultItemId}
			action={
				<DetailMutedPill>
					{craftStatusLabel({
						craft,
					})}
				</DetailMutedPill>
			}
		>
			<div className="grid gap-3">
				<div className="flex min-w-0 gap-3">
					<ItemInlineAsset
						item={resultItem}
						className="h-14 w-14"
					/>
					<div className="min-w-0 flex-1">
						<div className="h-2 overflow-hidden rounded-full bg-ak-surface-soft">
							<div
								className="h-full rounded-full bg-ak-primary transition-[width] duration-200 ease-linear"
								style={{
									width: `${Math.round(craft.progress * 100)}%`,
								}}
							/>
						</div>
						<p className="mt-2 break-words text-xs leading-5 text-ak-text-muted">
							Creates{" "}
							<strong className="text-ak-text">
								{resultItem?.name ?? craft.resultItemId}
							</strong>
							{craft.durationMs > 0
								? ` · build time ${formatMs(craft.durationMs)}`
								: ""}
						</p>
					</div>
				</div>

				{targetLimits.length ? (
					<div className="rounded-sm bg-ak-surface/80 px-2.5 py-2 text-xs">
						<p className="font-black text-ak-text">Target limits</p>
						<ul className="mt-1 grid gap-1 leading-5 text-ak-text-muted">
							{targetLimits.map((limit) => (
								<li key={`${craft.id}:target-limit:${limit.itemId}`}>
									{readTargetLimitLabel(limit, items)}
								</li>
							))}
						</ul>
					</div>
				) : null}

				{effectBlockReasons.length ? (
					<div className="rounded-sm bg-rose-400/14 px-2.5 py-2 text-xs text-rose-50">
						<p className="font-black text-rose-100">Blocked by effects</p>
						<ul className="mt-1 grid gap-1 leading-5 text-rose-100/80">
							{effectBlockReasons.map((reason) => (
								<li key={`${craft.id}:effect-block:${reason}`}>{reason}</li>
							))}
						</ul>
					</div>
				) : null}

				<div className="grid max-h-72 gap-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
					{craft.inputs.map((input) => {
						const delivered = craft.delivered[input.itemId] ?? 0;
						const canWithdraw = craft.phase === "collecting_inputs" && delivered > 0;
						const inputItem = items[input.itemId];
						const ready = delivered >= input.quantity;
						return (
							<div
								key={input.itemId}
								className="flex min-w-0 items-center gap-2 rounded-sm bg-ak-surface/80 px-2.5 py-2 text-sm"
							>
								<ItemInlineAsset
									item={inputItem}
									className="h-9 w-9"
								/>
								<div className="min-w-0 flex-1">
									<p className="break-words font-black text-ak-text">
										{inputItem?.name ?? input.itemId}
									</p>
									<p
										className={cn(
											"mt-0.5 text-xs leading-5",
											ready
												? "font-bold text-emerald-300"
												: "text-ak-text-muted",
										)}
									>
										{delivered}/{input.quantity}
										{!ready && input.available
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
			</div>
			<UiButton
				disabled={(!runState.canRunAction && !runState.canClaim) || pending}
				tone="primary"
				className="mt-3"
				onClick={runState.canClaim ? onClaim : onStart}
			>
				{runState.label}
			</UiButton>
		</DetailCard>
	);
};
