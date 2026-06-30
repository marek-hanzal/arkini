import type { FC } from "react";
import type { CraftProgressView } from "~/v0/board/view/CraftProgressViewSchema";
import { ItemInlineAsset } from "~/v0/item/ui/ItemInlineAsset";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import { formatMs } from "~/v0/time/formatMs";
import { UiButton } from "~/v0/ui/UiButton";
import { UiProgressButton } from "~/v0/ui/UiProgressButton";
import { cn } from "~/v0/ui/cn";
import type { DetailCraftControl } from "~/v0/item-detail/control/DetailCraftControl";
import { DetailCard } from "~/v0/item-detail/ui/DetailCard";

export namespace DetailCraftPanel {
	export interface Props {
		control: DetailCraftControl;
		craft: CraftProgressView;
		items: ItemCatalogView;
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

const readCraftInputRowClassName = ({
	available,
	fulfilled,
}: {
	available: boolean;
	fulfilled: boolean;
}) =>
	cn(
		"flex min-w-0 items-center gap-2 rounded-sm border px-2.5 py-2 text-sm transition-[background,border-color,box-shadow]",
		fulfilled
			? "border-emerald-300/30 bg-emerald-400/10 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.07)]"
			: available
				? "border-fuchsia-300/35 bg-fuchsia-400/10 shadow-[inset_0_0_0_1px_rgba(236,72,153,0.07)]"
				: "border-transparent bg-ak-surface/80",
	);

export const DetailCraftPanel: FC<DetailCraftPanel.Props> = ({ control, craft, items }) => {
	const resultItem = items[craft.resultItemId];
	const targetLimits = craft.targetLimits ?? [];
	const effectBlockReasons = craft.effectBlockReasons ?? [];
	const showInputs = craft.phase === "collecting_inputs" && craft.inputProgress < 1;

	return (
		<DetailCard
			eyebrow="Craft"
			title={resultItem?.name ?? craft.resultItemId}
		>
			<div className="grid gap-3">
				<div className="flex min-w-0 gap-3">
					<ItemInlineAsset
						item={resultItem}
						className="h-14 w-14"
					/>
					<div className="min-w-0 flex-1">
						<p className="break-words text-xs leading-5 text-ak-text-muted">
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

				{showInputs ? (
					<div className="grid gap-2">
						{craft.inputs.map((input) => {
							const delivered = craft.delivered[input.itemId] ?? 0;
							const withdrawAction =
								control.withdrawInputActionsByItemId[input.itemId];
							const inputItem = items[input.itemId];
							const ready = delivered >= input.quantity;
							const fillableQuantity = Math.min(
								Math.max(0, input.quantity - delivered),
								input.available ?? 0,
							);
							return (
								<div
									key={input.itemId}
									className={readCraftInputRowClassName({
										available: fillableQuantity > 0,
										fulfilled: ready,
									})}
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
											{!ready && fillableQuantity > 0
												? ` · +${fillableQuantity} available`
												: ""}
										</p>
									</div>
									{withdrawAction ? (
										<UiButton
											data-ui="withdraw action"
											disabled={withdrawAction.disabled}
											fullWidth={false}
											tone={withdrawAction.tone}
											onClick={withdrawAction.onClick}
										>
											{withdrawAction.label}
										</UiButton>
									) : null}
								</div>
							);
						})}
					</div>
				) : null}
			</div>
			<UiProgressButton
				disabled={control.primaryAction.disabled}
				progress={control.primaryAction.progress}
				progressAutoCompleteMs={control.primaryAction.progressAutoCompleteMs}
				tone={control.primaryAction.tone}
				className="mt-3 min-h-12 py-2.5"
				onClick={control.primaryAction.onClick}
			>
				<span className="flex min-w-0 flex-col items-center justify-center gap-1 leading-none">
					<span className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-white/75">
						{control.statusLabel}
					</span>
					<span>{control.primaryAction.label}</span>
				</span>
			</UiProgressButton>
		</DetailCard>
	);
};
