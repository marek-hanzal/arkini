import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { type FC, useCallback, useMemo, useState } from "react";
import { useHardResetMutation } from "~/v0/database/action/useHardResetMutation";
import { databaseStatusQueryOptions } from "~/v0/database/query/databaseStatusQueryOptions";
import { StatusPill } from "~/v0/database/StatusPill";
import { DebugBugReport } from "~/v0/debug/DebugBugReport";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import { SheetHeader } from "~/v0/play/sheet/SheetHeader";
import { cn } from "~/v0/ui/cn";

export namespace DevSheet {
	export interface Props {
		onClose(): void;
	}
}

const DebugButton: FC<{
	children: string;
	disabled?: boolean;
	tone?: "primary" | "neutral" | "danger";
	onClick(): void;
}> = ({ children, disabled, onClick, tone = "neutral" }) => (
	<button
		type="button"
		disabled={disabled}
		onClick={onClick}
		className={cn(
			"rounded-md border px-3 py-2 text-sm font-bold disabled:cursor-wait disabled:opacity-60",
			tone === "primary" ? "border-emerald-300/45 bg-emerald-300 text-slate-950" : undefined,
			tone === "neutral" ? "border-slate-600 bg-slate-800/80 text-slate-100" : undefined,
			tone === "danger" ? "border-red-300/45 bg-red-300 text-slate-950" : undefined,
		)}
	>
		{children}
	</button>
);

export const DevSheet: FC<DevSheet.Props> = ({ onClose }) => {
	const queryClient = useQueryClient();
	const { data: status } = useSuspenseQuery(databaseStatusQueryOptions());
	const hardResetMutation = useHardResetMutation();
	const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
	const [timelineSize, setTimelineSize] = useState(DebugTimeline.entries().length);
	const isolated = window.crossOriginIsolated;
	const queryCount = queryClient.getQueryCache().getAll().length;

	const dumpPreview = useMemo(() => {
		const report = DebugBugReport.report();
		return JSON.stringify(
			{
				schema: report.schema,
				createdAtIso: report.createdAtIso,
				context: report.context,
				timelineCount: Array.isArray(report.timeline) ? report.timeline.length : 0,
				queryCount,
			},
			null,
			"\t",
		);
	}, [
		queryCount,
		timelineSize,
	]);

	const copyBugReport = useCallback(() => {
		setCopyState("idle");
		DebugBugReport.copy()
			.then(() => {
				setTimelineSize(DebugTimeline.entries().length);
				setCopyState("copied");
			})
			.catch((error: unknown) => {
				console.error("Failed to copy Arkini debug report", error);
				setCopyState("failed");
			});
	}, []);

	const clearTimeline = useCallback(() => {
		DebugBugReport.clear();
		setTimelineSize(0);
		setCopyState("idle");
	}, []);

	return (
		<section className="max-h-[var(--ak-sheet-max-height)] overflow-y-auto overscroll-contain">
			<SheetHeader
				eyebrow="Developer"
				description="Debug, diagnostics and local save tools"
				onClose={onClose}
			/>
			<div className="grid gap-3 p-4 pt-1">
				<section className="rounded-md border border-emerald-300/20 bg-emerald-950/20 p-3 shadow-lg shadow-slate-950/25">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
						<div>
							<p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-emerald-300">
								Bug report
							</p>
							<h2 className="mt-1 text-base font-semibold text-white">
								Copy diagnostic dump
							</h2>
							<p className="mt-2 text-sm text-slate-300">
								One JSON packet with browser metadata, query cache snapshots and the
								latest debug timeline. Paste it into chat after reproducing a bug.
							</p>
						</div>
						<div className="flex shrink-0 flex-wrap gap-2">
							<DebugButton
								tone="primary"
								onClick={copyBugReport}
							>
								Copy bug report
							</DebugButton>
							<DebugButton onClick={clearTimeline}>Clear timeline</DebugButton>
						</div>
					</div>
					<div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
						<StatusPill
							label="Timeline"
							value={String(timelineSize)}
						/>
						<StatusPill
							label="Queries"
							value={String(queryCount)}
						/>
						<StatusPill
							label="Mode"
							value={import.meta.env.MODE}
						/>
						<StatusPill
							label="DPR"
							value={String(window.devicePixelRatio)}
						/>
					</div>
					{copyState === "copied" ? (
						<p className="mt-3 text-sm font-semibold text-emerald-200">
							Copied. Paste the JSON dump into chat with a one-line symptom.
						</p>
					) : null}
					{copyState === "failed" ? (
						<p className="mt-3 text-sm font-semibold text-red-100">
							Copy failed. Use window.__ARKINI_BUG_REPORT__.dump() in the console.
						</p>
					) : null}
					<pre className="mt-3 max-h-36 overflow-auto rounded-md border border-slate-800 bg-slate-950/80 p-2 text-[0.65rem] text-slate-300">
						{dumpPreview}
					</pre>
				</section>

				<section className="rounded-md border border-slate-800 bg-slate-900/60 p-3 shadow-lg shadow-slate-950/25">
					<div className="flex h-full flex-wrap items-center gap-4">
						<div className="min-w-40">
							<p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-indigo-300">
								SQLite / OPFS
							</p>
							<h2 className="mt-1 text-base font-semibold text-white">Local save</h2>
							<span
								className={cn(
									"mt-2 inline-flex rounded-sm px-2 py-1 text-xs font-semibold",
									isolated
										? "bg-emerald-400/10 text-emerald-200"
										: "bg-amber-400/10 text-amber-200",
								)}
							>
								{isolated ? "isolated" : "headers missing"}
							</span>
						</div>

						<div className="grid min-w-64 flex-1 grid-cols-2 gap-2">
							<StatusPill
								label="DB"
								value={status.databasePath}
							/>
							<StatusPill
								label="Sync"
								value={status.gameConfigHash}
							/>
							<StatusPill
								label="Items"
								value={String(status.itemCount)}
							/>
							<StatusPill
								label="Prod"
								value={String(status.producerCount)}
							/>
						</div>

						<div className="min-w-40">
							<DebugButton
								tone="danger"
								disabled={hardResetMutation.isPending}
								onClick={() => hardResetMutation.mutate()}
							>
								{hardResetMutation.isPending
									? "Dropping OPFS storage…"
									: "Hard reset DB"}
							</DebugButton>
							{hardResetMutation.isError ? (
								<p className="mt-3 text-sm text-red-100">
									Reset failed. Check the console.
								</p>
							) : null}
						</div>
					</div>
				</section>
			</div>
		</section>
	);
};
