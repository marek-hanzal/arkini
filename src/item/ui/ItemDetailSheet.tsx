import type { FC } from "react";
import { GameItemView } from "~/item/ui/GameItemView";
import { useGameCommand } from "~/play/hook/useGameCommand";
import { usePlayBoard } from "~/play/hook/usePlayBoard";
import { usePlayDataInvalidation } from "~/play/hook/usePlayDataInvalidation";
import { usePlayItems } from "~/play/hook/usePlayItems";
import { useProducerClock } from "~/producer/hook/useProducerClock";
import { isProducerReady } from "~/producer/logic/isProducerReady";
import { isProducerStocked } from "~/producer/logic/isProducerStocked";
import { readProducerCooldown } from "~/producer/logic/readProducerCooldown";
import { cn } from "~/shared/cn";
import { SheetHeader } from "~/shared/ui/SheetHeader";
import { formatMs } from "~/shared/util/formatMs";

export namespace ItemDetailSheet {
	export interface Props {
		boardItemId?: string;
		onClose(): void;
	}
}

export const ItemDetailSheet: FC<ItemDetailSheet.Props> = ({ boardItemId, onClose }) => {
	const board = usePlayBoard().data;
	const items = usePlayItems().data;
	const invalidatePlayData = usePlayDataInvalidation();
	const nowMs = useProducerClock(board?.items ?? []);
	const withdrawInput = useGameCommand({
		invalidateOnSuccess: false,
	});
	const boardItem = boardItemId ? board?.byId[boardItemId] : undefined;
	const item = boardItem ? items?.[boardItem.itemId] : undefined;

	if (!boardItem || !item || !items) return null;

	const mergeResults = item.mergeResults ?? [];
	const craft = boardItem.craft;
	const usedInCrafts = item.usedInCrafts ?? [];
	const usedInMerges = item.usedInMerges ?? [];
	const activation = boardItem.activation;
	const activationInputs = activation?.inputs ?? [];
	const activationCooldown = readProducerCooldown({
		activation,
		nowMs,
	});
	const activationReady = isProducerReady(activation, nowMs);
	const activationHasCharges = activation
		? activation.remainingCharges === undefined || activation.remainingCharges > 0
		: false;
	const activationHasInputs = isProducerStocked(activation);
	const activationStatusLabel = activationReady
		? "Ready"
		: !activationHasCharges
			? "Empty"
			: activationCooldown
				? activationHasInputs
					? `Ready in ${formatMs(activationCooldown.remainingMs)}`
					: `Cooldown ${formatMs(activationCooldown.remainingMs)}`
				: activationHasInputs
					? "Not ready"
					: "Needs inputs";
	const activationTitle = activation
		? activation.kind === "stash"
			? "Stash status"
			: "Producer status"
		: undefined;
	const activationInputTitle = activation?.kind === "stash" ? "Stash inputs" : "Producer inputs";
	const craftStatusLabel = craft
		? craft.phase === "collecting_inputs"
			? "Collecting inputs"
			: craft.phase === "waiting"
				? craft.remainingMs !== undefined
					? `Ready in ${formatMs(craft.remainingMs)}`
					: "Building"
				: "Ready"
		: undefined;

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
							<p className="text-xs text-emerald-100">{craftStatusLabel}</p>
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
						{craft.durationMs > 0 ? (
							<p className="mt-1 text-xs text-slate-400">
								Build time: {formatMs(craft.durationMs)}
							</p>
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
												delivered >= input.quantity
													? "text-emerald-200"
													: "text-slate-400",
											)}
										>
											{delivered}/{input.quantity}
										</span>
									</div>
								);
							})}
						</div>
					</div>
				) : null}

				{activation && activationTitle ? (
					<div className="rounded-md border border-cyan-400/20 bg-cyan-950/18 p-3">
						<div className="flex items-center justify-between gap-3">
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
								{activationTitle}
							</p>
							<p className="text-xs text-cyan-100">{activationStatusLabel}</p>
						</div>
						{activationCooldown ? (
							<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-950/80">
								<div
									className="h-full rounded-full bg-cyan-300/75 transition-[width] duration-200 ease-linear"
									style={{
										width: `${Math.round(activationCooldown.progress * 100)}%`,
									}}
								/>
							</div>
						) : null}
						{activation.remainingCharges !== undefined ? (
							<p className="mt-3 text-xs text-slate-300">
								Charges left: <strong>{activation.remainingCharges}</strong>
							</p>
						) : null}
					</div>
				) : null}

				{activationInputs.length > 0 ? (
					<div className="rounded-md border border-amber-400/20 bg-amber-950/18 p-3">
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
							{activationInputTitle}
						</p>
						<div className="mt-3 space-y-2">
							{activationInputs.map((input) => (
								<div
									key={input.itemId}
									className="flex items-center justify-between gap-3 rounded-sm bg-slate-950/45 px-2 py-1.5 text-xs"
								>
									<span>
										{items[input.itemId]?.name ?? input.itemId}: {input.stored}/
										{input.capacity} stored, consumes {input.quantity}
									</span>
									<button
										type="button"
										disabled={input.stored <= 0 || withdrawInput.isPending}
										onClick={() => {
											void withdrawInput
												.mutateAsync({
													type: "producer.withdrawInput",
													boardItemId: boardItem.id,
													itemId: input.itemId,
												})
												.then(() =>
													invalidatePlayData([
														"board",
														"inventory",
														"databaseStatus",
													]),
												);
										}}
										className="rounded-sm bg-slate-800 px-2 py-1 font-bold text-slate-200 disabled:opacity-35"
									>
										Withdraw
									</button>
								</div>
							))}
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

				{usedInMerges.length > 0 ? (
					<div className="rounded-md border border-slate-800 bg-slate-950/50 p-3">
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
							Can be merged with
						</p>
						<div className="mt-2 space-y-2">
							{usedInMerges.map((rule) => (
								<div
									key={`${rule.targetItemId}:${rule.resultItemId}`}
									className="rounded-sm bg-slate-900/70 px-2 py-1.5 text-xs text-slate-300"
								>
									{items[rule.targetItemId]?.name ?? rule.targetItemId} →{" "}
									{items[rule.resultItemId]?.name ?? rule.resultItemId}
								</div>
							))}
						</div>
					</div>
				) : null}

				{usedInCrafts.length > 0 ? (
					<div className="rounded-md border border-slate-800 bg-slate-950/50 p-3">
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
							Used in crafts
						</p>
						<div className="mt-2 space-y-2">
							{usedInCrafts.map((recipe) => (
								<div
									key={`${recipe.targetItemId}:${recipe.resultItemId}`}
									className="rounded-sm bg-slate-900/70 px-2 py-1.5 text-xs text-slate-300"
								>
									{items[recipe.targetItemId]?.name ?? recipe.targetItemId} →{" "}
									{items[recipe.resultItemId]?.name ?? recipe.resultItemId}
								</div>
							))}
						</div>
					</div>
				) : null}
			</div>
		</section>
	);
};
