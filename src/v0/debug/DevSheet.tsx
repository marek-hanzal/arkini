import { type FC, useCallback, useEffect, useMemo, useState } from "react";
import { hardResetBrowserStorage } from "~/v0/browser/hardResetBrowserStorage";
import { DebugBugReport } from "~/v0/debug/DebugBugReport";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import {
	DevScenarioDefinitions,
	type DevScenarioId,
	isDevScenarioId,
} from "~/v0/debug/scenario/DevScenarioDefinitions";
import { useLoadDevScenarioAction } from "~/v0/debug/scenario/useLoadDevScenarioAction";
import { StatusPill } from "~/v0/debug/ui/StatusPill";
import { useGameRuntimeSelector } from "~/v0/play/runtime";
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

const formatWake = (nextWakeAtMs: number | null) => {
	if (nextWakeAtMs === null) return "idle";
	return `${Math.max(0, nextWakeAtMs - Date.now())}ms`;
};

export const DevSheet: FC<DevSheet.Props> = ({ onClose }) => {
	const loadScenarioAction = useLoadDevScenarioAction();
	const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
	const [resetState, setResetState] = useState<"idle" | "pending" | "failed">("idle");
	const [timelineSize, setTimelineSize] = useState(DebugTimeline.entries().length);
	const runtime = useGameRuntimeSelector(
		(state) => ({
			boardItems: state.board.items.length,
			inventoryStacks: state.inventory.slots.filter((slot) => slot.stack).length,
			nextWakeAtMs: state.runtime.nextWakeAtMs,
			revision: state.revision,
		}),
		(left, right) =>
			left.boardItems === right.boardItems &&
			left.inventoryStacks === right.inventoryStacks &&
			left.nextWakeAtMs === right.nextWakeAtMs &&
			left.revision === right.revision,
	);

	const loadScenario = useCallback(
		(scenarioId: DevScenarioId) => {
			setCopyState("idle");
			void loadScenarioAction
				.run({
					scenarioId,
				})
				.finally(() => setTimelineSize(DebugTimeline.entries().length));
		},
		[
			loadScenarioAction,
		],
	);

	useEffect(() => {
		if (!import.meta.env.DEV) return;

		Object.assign(window, {
			__ARKINI_SCENARIO__: {
				list: () => DevScenarioDefinitions,
				load: async (scenarioId: string) => {
					if (!isDevScenarioId(scenarioId)) {
						throw new Error(`Unknown Arkini dev scenario ${scenarioId}.`);
					}

					const result = await loadScenarioAction.run({
						scenarioId,
					});
					setTimelineSize(DebugTimeline.entries().length);
					return result;
				},
			},
		});
	}, [
		loadScenarioAction,
	]);

	const dumpPreview = useMemo(() => {
		const report = DebugBugReport.report();
		return JSON.stringify(
			{
				schema: report.schema,
				createdAtIso: report.createdAtIso,
				context: report.context,
				timelineCount: Array.isArray(report.timeline) ? report.timeline.length : 0,
			},
			null,
			"\t",
		);
	}, [
		runtime.revision,
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

	const hardReset = useCallback(() => {
		setResetState("pending");
		void hardResetBrowserStorage()
			.then(() => window.location.reload())
			.catch((error: unknown) => {
				console.error("Failed to hard reset Arkini browser storage", error);
				setResetState("failed");
			});
	}, []);

	return (
		<section className="max-h-[var(--ak-sheet-max-height)] overflow-y-auto overscroll-contain">
			<SheetHeader
				eyebrow="Developer"
				description="Debug, diagnostics and runtime tools"
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
								One JSON packet with browser metadata, runtime diagnostics and the
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
							label="Revision"
							value={String(runtime.revision)}
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

				<section className="rounded-md border border-indigo-300/20 bg-indigo-950/20 p-3 shadow-lg shadow-slate-950/25">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
						<div>
							<p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-indigo-300">
								Scenarios
							</p>
							<h2 className="mt-1 text-base font-semibold text-white">
								Load debug save
							</h2>
							<p className="mt-2 text-sm text-slate-300">
								Reset the runtime save into a deterministic state before reproducing
								an animation bug. The loaded scenario is recorded into the bug
								report timeline.
							</p>
						</div>
						<div className="shrink-0">
							<StatusPill
								label="Scenarios"
								value={String(DevScenarioDefinitions.length)}
							/>
						</div>
					</div>
					<div className="mt-3 grid gap-2">
						{DevScenarioDefinitions.map((scenario) => (
							<button
								type="button"
								key={scenario.id}
								disabled={loadScenarioAction.isPending}
								onClick={() => loadScenario(scenario.id)}
								className="rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2 text-left transition hover:border-indigo-300/60 hover:bg-indigo-950/35 disabled:cursor-wait disabled:opacity-60"
							>
								<span className="block text-sm font-bold text-slate-50">
									{scenario.label}
								</span>
								<span className="mt-1 block text-xs text-slate-400">
									{scenario.description}
								</span>
							</button>
						))}
					</div>
					{loadScenarioAction.data ? (
						<p className="mt-3 text-sm font-semibold text-indigo-100">
							Loaded {loadScenarioAction.data.scenarioId}. Reproduce the bug, then
							copy a bug report.
						</p>
					) : null}
					{loadScenarioAction.isError ? (
						<p className="mt-3 text-sm font-semibold text-red-100">
							Scenario load failed. Check the console; naturally, even debugging needs
							debugging.
						</p>
					) : null}
				</section>

				<section className="rounded-md border border-slate-800 bg-slate-900/60 p-3 shadow-lg shadow-slate-950/25">
					<div className="flex h-full flex-wrap items-center gap-4">
						<div className="min-w-40">
							<p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-indigo-300">
								Runtime
							</p>
							<h2 className="mt-1 text-base font-semibold text-white">
								Local session
							</h2>
							<span className="mt-2 inline-flex rounded-sm bg-emerald-400/10 px-2 py-1 text-xs font-semibold text-emerald-200">
								runtime-only
							</span>
						</div>

						<div className="grid min-w-64 flex-1 grid-cols-2 gap-2">
							<StatusPill
								label="Board"
								value={String(runtime.boardItems)}
							/>
							<StatusPill
								label="Inventory"
								value={String(runtime.inventoryStacks)}
							/>
							<StatusPill
								label="Next tick"
								value={formatWake(runtime.nextWakeAtMs)}
							/>
							<StatusPill
								label="Source"
								value="Runtime store"
							/>
						</div>

						<div className="min-w-40">
							<DebugButton
								tone="danger"
								disabled={resetState === "pending"}
								onClick={hardReset}
							>
								{resetState === "pending"
									? "Dropping browser storage…"
									: "Hard reset storage"}
							</DebugButton>
							{resetState === "failed" ? (
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
