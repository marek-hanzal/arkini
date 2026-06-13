import type { FC } from "react";
import { usePlayBoard } from "~/play/hook/usePlayBoard";
import { usePlayItems } from "~/play/hook/usePlayItems";
import { SheetHeader } from "~/shared/ui/SheetHeader";
import { GameItemView } from "~/item/ui/GameItemView";

export namespace ItemDetailSheet {
	export interface Props {
		boardItemId?: string;
		onClose(): void;
	}
}

export const ItemDetailSheet: FC<ItemDetailSheet.Props> = ({ boardItemId, onClose }) => {
	const board = usePlayBoard().data;
	const items = usePlayItems().data;
	const boardItem = boardItemId ? board?.byId[boardItemId] : undefined;
	const item = boardItem ? items?.[boardItem.itemId] : undefined;

	if (!boardItem || !item || !items) return null;

	const mergeResults = item.mergeResults ?? [];
	const craft = boardItem.craft;
	const usedInCrafts = item.usedInCrafts ?? [];

	return (
		<section className="max-h-[var(--ak-sheet-max-height)] overflow-y-auto overscroll-contain">
			<SheetHeader
				eyebrow="Item"
				description={item.name}
				onClose={onClose}
			/>
			<div className="space-y-4 p-4 pt-1 text-sm text-slate-200">
				<div className="flex gap-3 rounded-md border border-slate-800 bg-slate-950/60 p-3">
					<div className="h-16 w-16 shrink-0 rounded-md bg-slate-900/70">
						<GameItemView
							item={item}
							variant="inventory"
						/>
					</div>
					<div className="min-w-0">
						<h2 className="font-semibold text-slate-50">{item.name}</h2>
						<p className="mt-1 text-xs leading-5 text-slate-400">{item.description}</p>
					</div>
				</div>

				{craft ? (
					<div className="rounded-md border border-emerald-400/20 bg-emerald-950/18 p-3">
						<div className="flex items-center justify-between gap-3">
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
								Craft progress
							</p>
							<p className="text-xs text-emerald-100">
								{Math.round(craft.progress * 100)}%
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
							Creates{" "}
							<strong>{items[craft.resultItemId]?.name ?? craft.resultItemId}</strong>
						</p>
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
											className={
												delivered >= input.quantity
													? "text-emerald-200"
													: "text-slate-400"
											}
										>
											{delivered}/{input.quantity}
										</span>
									</div>
								);
							})}
						</div>
					</div>
				) : null}

				{mergeResults.length > 0 ? (
					<div className="rounded-md border border-slate-800 bg-slate-950/50 p-3">
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
							Can merge into
						</p>
						<div className="mt-2 space-y-2">
							{mergeResults.map((rule) => (
								<div
									key={`${rule.withItemId}:${rule.resultItemId}`}
									className="rounded-sm bg-slate-900/70 px-2 py-1.5 text-xs text-slate-300"
								>
									{items[rule.withItemId]?.name ?? rule.withItemId} →{" "}
									{items[rule.resultItemId]?.name ?? rule.resultItemId}
								</div>
							))}
						</div>
					</div>
				) : null}

				{usedInCrafts.length > 0 ? (
					<div className="rounded-md border border-slate-800 bg-slate-950/50 p-3">
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
							Can be used for
						</p>
						<div className="mt-2 space-y-2">
							{usedInCrafts.map((craft) => (
								<div
									key={`${craft.targetItemId}:${craft.resultItemId}`}
									className="rounded-sm bg-slate-900/70 px-2 py-1.5 text-xs text-slate-300"
								>
									{items[craft.targetItemId]?.name ?? craft.targetItemId} →{" "}
									{items[craft.resultItemId]?.name ?? craft.resultItemId}
								</div>
							))}
						</div>
					</div>
				) : null}
			</div>
		</section>
	);
};
