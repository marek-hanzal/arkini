import type { FC } from "react";
import type { CraftProgressView } from "~/board/view/CraftProgressViewSchema";
import { ItemInlineAsset } from "~/item/ui/ItemInlineAsset";
import type { ItemCatalogView } from "~/item/view/ItemCatalogViewSchema";
import { formatMs } from "~/time/formatMs";
import { UiButton } from "~/ui/UiButton";
import { UiProgressButton } from "~/ui/UiProgressButton";
import { cn } from "~/ui/cn";
import type { DetailCraftControl } from "~/item-detail/control/DetailCraftControl";
import { DetailCard } from "~/item-detail/ui/DetailCard";
import { DetailLineOutputs } from "~/item-detail/ui/DetailLineOutputs";
import { DetailTargetLimits } from "~/item-detail/ui/DetailTargetLimits";

export namespace DetailCraftPanel {
	export interface Props {
		control: DetailCraftControl;
		craft: CraftProgressView;
		items: ItemCatalogView;
	}
}

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
				? "border-fuchsia-300/65 bg-fuchsia-400/10 shadow-[inset_0_0_0_1px_rgba(236,72,153,0.07)]"
				: "border-transparent bg-ak-surface/80",
	);

type CraftBlockerRow = {
	itemId?: string;
	label: string;
	reason: string;
};

const readCraftBlockerRows = (craft: CraftProgressView): CraftBlockerRow[] => [
	...(craft.effectBlockReasons ?? []).map((reason) => ({
		label: reason,
		reason: "Blocks craft",
	})),
	...(craft.effectRequirements ?? [])
		.filter((requirement) => !requirement.ready && requirement.kind !== "grant.blockStart")
		.map((requirement) => ({
			itemId: requirement.itemId,
			label: requirement.label,
			reason: "Needed before crafting",
		})),
];

export const DetailCraftPanel: FC<DetailCraftPanel.Props> = ({ control, craft, items }) => {
	const resultItem = items[craft.resultItemId];
	const targetLimits = craft.targetLimits ?? [];
	const blockerRows = readCraftBlockerRows(craft);
	const showInputs = craft.phase === "collecting_inputs" && blockerRows.length === 0;

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

				<DetailTargetLimits
					id={craft.id}
					items={items}
					limits={targetLimits}
				/>

				<DetailLineOutputs
					items={items}
					line={{
						lineId: craft.id,
						outputs: craft.outputs,
					}}
				/>

				{blockerRows.length ? (
					<div className="grid gap-2">
						<p className="text-xs font-black uppercase tracking-[0.2em] text-rose-600/85">
							Craft blockers
						</p>
						{blockerRows.map((blocker, blockerIndex) => {
							const blockerItem = blocker.itemId ? items[blocker.itemId] : undefined;
							return (
								<div
									key={`${craft.id}:craft-blocker:${blockerIndex}:${blocker.itemId ?? blocker.label}`}
									className="flex min-w-0 items-center gap-2 rounded-sm border border-rose-300/65 bg-rose-100/70 px-2.5 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(251,113,133,0.06)]"
								>
									{blocker.itemId ? (
										<ItemInlineAsset
											item={blockerItem}
											className="h-9 w-9"
										/>
									) : null}
									<div className="min-w-0 flex-1">
										<p className="break-words font-black text-rose-900">
											{blockerItem?.name ?? blocker.label}
										</p>
										<p className="mt-0.5 text-xs leading-5 text-rose-700/85">
											{blocker.reason}
										</p>
									</div>
								</div>
							);
						})}
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
													? "font-bold text-emerald-700"
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
				tone={control.primaryAction.tone}
				className="mt-3 min-h-12 py-2.5"
				onClick={control.primaryAction.onClick}
			>
				<span className="flex min-w-0 flex-col items-center justify-center gap-1 leading-none">
					<span className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-white/85">
						{control.statusLabel}
					</span>
					<span>{control.primaryAction.label}</span>
				</span>
			</UiProgressButton>
		</DetailCard>
	);
};
