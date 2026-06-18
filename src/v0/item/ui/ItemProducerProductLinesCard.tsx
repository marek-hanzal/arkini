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
	}
}

export const ItemProducerProductLinesCard: FC<ItemProducerProductLinesCard.Props> = ({
	lines,
	nowMs,
	pending,
	onSetEnabled,
	onStart,
}) => {
	if (lines.length === 0) return null;

	return (
		<div className="rounded-md border border-violet-400/20 bg-violet-950/18 p-3">
			<p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
				Product lines
			</p>
			<div className="mt-3 space-y-2">
				{lines.map((baseLine) => {
					const line = readLiveProducerProductLineView({
						line: baseLine,
						nowMs,
					});
					const canStart =
						line.enabled &&
						line.inputItemIds.length === 0 &&
						line.requirementsReady &&
						!line.queueFull;
					const remainingMs = line.readyAtMs
						? Math.max(0, line.readyAtMs - nowMs)
						: undefined;

					return (
						<div
							key={line.productId}
							className={cn(
								"rounded-sm border px-2 py-2 text-xs",
								line.enabled
									? "border-violet-300/20 bg-slate-950/45 text-slate-200"
									: "border-slate-800 bg-slate-950/25 text-slate-500",
							)}
						>
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0">
									<p className="font-bold text-slate-100">{line.name}</p>
									<p className="mt-1 text-[0.7rem] text-slate-400">
										Queue {line.producerQueuedJobs}/{line.queueSize} ·{" "}
										{formatMs(line.durationMs)}
										{line.inputItemIds.length
											? ` · needs ${line.inputItemIds.length} input type${line.inputItemIds.length === 1 ? "" : "s"}`
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
										"shrink-0 rounded-sm px-2 py-1 font-black transition disabled:opacity-35",
										line.enabled
											? "bg-emerald-300 text-slate-950"
											: "bg-slate-800 text-slate-300",
									)}
								>
									{line.enabled ? "On" : "Off"}
								</button>
							</div>

							{line.inProgress ? (
								<div className="mt-2 rounded-sm bg-slate-950/60 p-2">
									<div className="flex justify-between gap-3 font-bold text-violet-100">
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
									<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-900">
										<div
											className="h-full rounded-full bg-violet-300/80"
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
									"mt-2 w-full rounded-sm px-2 py-1.5 font-black transition disabled:opacity-35",
									canStart
										? "bg-violet-300 text-slate-950 active:scale-[0.99]"
										: "bg-slate-800 text-slate-500",
								)}
							>
								{line.queueFull
									? "Queue full"
									: line.inputItemIds.length
										? "Feed items by drag"
										: !line.requirementsReady
											? "Drag requirements in"
											: "Start"}
							</button>
						</div>
					);
				})}
			</div>
		</div>
	);
};
