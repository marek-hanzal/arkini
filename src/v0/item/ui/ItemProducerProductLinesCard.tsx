import type { FC } from "react";
import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";
import { readLiveProducerProductLineView } from "~/v0/producer/logic/readLiveProducerProductLineView";
import { formatMs } from "~/v0/time/formatMs";
import { cn } from "~/v0/ui/cn";

export namespace ItemProducerProductLinesCard {
	export interface Props {
		lines: readonly ProducerProductLineView[];
		nowMs: number;
		pending: boolean;
		onSetEnabled(productId: string, enabled: boolean): void;
		onStart(productId: string): void;
		onWithdrawInput(productId: string, itemId: string): void;
	}
}

export const ItemProducerProductLinesCard: FC<ItemProducerProductLinesCard.Props> = ({
	lines,
	nowMs,
	pending,
	onSetEnabled,
	onStart,
	onWithdrawInput,
}) => {
	if (lines.length === 0) return null;

	return (
		<div
			data-ui="producer controls"
			className="rounded-sm border border-ak-border bg-ak-surface-soft p-3"
		>
			<p className="text-[0.66rem] font-extrabold uppercase tracking-[0.16em] text-ak-primary">
				Product lines
			</p>
			<div className="mt-3 grid gap-2">
				{lines.map((baseLine) => {
					const line = readLiveProducerProductLineView({
						line: baseLine,
						nowMs,
					});
					const canStart =
						line.enabled &&
						line.inputsReady &&
						line.requirementsReady &&
						!line.queueFull;
					const remainingMs = line.readyAtMs
						? Math.max(0, line.readyAtMs - nowMs)
						: undefined;

					return (
						<div
							key={line.productId}
							className={cn(
								"rounded-sm bg-white/70 min-w-0 px-3 py-3 text-xs",
								!line.enabled && "opacity-70",
							)}
						>
							<div className="flex min-w-0 items-start justify-between gap-3">
								<div className="min-w-0">
									<p className="truncate font-bold text-ak-text">{line.name}</p>
									<p className="text-ak-text-muted mt-1 break-words text-[0.7rem] leading-4">
										Queue {line.producerQueuedJobs}/{line.queueSize} ·{" "}
										{formatMs(line.durationMs)}
										{line.inputItemIds.length
											? ` · ${line.inputsReady ? "input ready" : "needs input"}`
											: " · tap to run"}
										{line.requirementItemIds.length
											? ` · ${line.requirementItemIds.length} requirement${line.requirementItemIds.length === 1 ? "" : "s"}`
											: ""}
										{line.missingRequirementItemIds.length
											? ` · missing ${line.missingRequirementItemIds.length}`
											: ""}
									</p>
								</div>
								<button
									type="button"
									disabled={pending}
									onClick={() => onSetEnabled(line.productId, !line.enabled)}
									className={cn(
										"min-h-10 shrink-0 rounded-sm border px-3 py-2 text-xs font-extrabold leading-none transition-[transform,border-color,background,color,opacity] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45",
										line.enabled
											? "border-ak-border bg-ak-surface-soft text-ak-text hover:border-ak-border-accent hover:bg-ak-primary-soft"
											: "border-ak-border bg-ak-surface text-ak-text hover:border-ak-border-accent hover:bg-ak-surface-soft",
									)}
								>
									{line.enabled ? "On" : "Off"}
								</button>
							</div>

							{line.inputs.length ? (
								<div className="mt-2 grid gap-1.5">
									{line.inputs.map((input) => (
										<div
											key={input.itemId}
											className="flex min-w-0 items-center justify-between gap-2 rounded-sm bg-ak-surface px-2 py-2 text-[0.7rem]"
										>
											<span className="min-w-0 truncate font-semibold text-ak-text">
												{input.itemId.replace(/^item:/, "")}
											</span>
											<span className="text-ak-text-muted ml-auto shrink-0 tabular-nums">
												{input.stored}/{input.quantity}
												{input.capacity > input.quantity
													? ` · cap ${input.capacity}`
													: ""}
											</span>
											{input.stored > 0 ? (
												<button
													type="button"
													data-ui="withdraw action"
													disabled={pending}
													onClick={() =>
														onWithdrawInput(
															line.productId,
															input.itemId,
														)
													}
													className="min-h-10 shrink-0 rounded-sm border border-ak-border bg-ak-surface px-3 py-2 text-xs font-extrabold leading-none text-ak-text transition-[transform,border-color,background,color,opacity] hover:border-ak-border-accent hover:bg-ak-surface-soft active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45"
												>
													Withdraw
												</button>
											) : null}
										</div>
									))}
								</div>
							) : null}

							{line.inProgress ? (
								<div className="mt-2 rounded-sm bg-ak-surface p-2">
									<div className="flex justify-between gap-3 font-bold text-ak-primary">
										<span>
											Running
											{line.queuedJobs > 1
												? ` +${line.queuedJobs - 1} queued`
												: ""}
										</span>
										<span>
											{remainingMs !== undefined
												? formatMs(remainingMs)
												: "Queued"}
										</span>
									</div>
									<div className="mt-2 h-1.5 overflow-hidden rounded-sm bg-ak-surface">
										<div
											className="h-full rounded-sm bg-ak-primary transition-[width] duration-200 ease-linear"
											style={{
												width: `${Math.round((line.progress ?? 0) * 100)}%`,
											}}
										/>
									</div>
								</div>
							) : null}

							<button
								type="button"
								disabled={!canStart || pending}
								onClick={() => onStart(line.productId)}
								className={cn(
									"mt-2 min-h-10 w-full rounded-sm border px-3 py-2 text-xs font-extrabold leading-none transition-[transform,border-color,background,color,opacity] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45",
									canStart
										? "border-ak-border-accent bg-ak-primary text-white hover:bg-pink-400"
										: "border-ak-border bg-ak-surface text-ak-text hover:border-ak-border-accent hover:bg-ak-surface-soft",
								)}
							>
								{line.queueFull
									? "Queue full"
									: !line.requirementsReady
										? "Drag requirements in"
										: !line.inputsReady
											? "Feed items by drag"
											: "Start"}
							</button>
						</div>
					);
				})}
			</div>
		</div>
	);
};
