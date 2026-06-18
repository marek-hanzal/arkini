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
import { useLiveNowMs } from "~/v0/time/useLiveNowMs";
import { SheetHeader } from "~/v0/play/sheet/SheetHeader";
import { cn } from "~/v0/ui/cn";

export namespace DevSheet {
	export interface Props {
		onClose(): void;
	}
}

const debugButtonToneClassName: Record<"primary" | "neutral" | "danger", string> = {
	danger: "border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100",
	neutral: "border-pink-200 bg-white text-ak-text hover:bg-pink-50",
	primary: "border-fuchsia-500 bg-fuchsia-600 text-white hover:bg-fuchsia-700",
};

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
			"min-h-10 rounded-sm border px-3 py-2 text-xs font-extrabold leading-none transition-[transform,border-color,background,color,opacity] active:translate-y-px disabled:cursor-wait disabled:opacity-45",
			debugButtonToneClassName[tone],
		)}
	>
		{children}
	</button>
);

const formatWake = (nextWakeAtMs: number | null, nowMs: number) => {
	if (nextWakeAtMs === null) return "idle";
	return `${Math.max(0, nextWakeAtMs - nowMs)}ms`;
};

export const DevSheet: FC<DevSheet.Props> = ({ onClose }) => {
	const loadScenarioAction = useLoadDevScenarioAction();
	const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
	const [resetState, setResetState] = useState<"idle" | "pending" | "failed">("idle");
	const [timelineSize, setTimelineSize] = useState(DebugTimeline.entries().length);
	const runtime = useGameRuntimeSelector(
		(state) => ({
			boardItems: Object.keys(state.runtime.save.board.items).length,
			inventoryStacks: state.runtime.save.inventory.slots.filter(Boolean).length,
			nextWakeAtMs: state.runtime.nextWakeAtMs,
			revision: state.revision,
		}),
		(left, right) =>
			left.boardItems === right.boardItems &&
			left.inventoryStacks === right.inventoryStacks &&
			left.nextWakeAtMs === right.nextWakeAtMs &&
			left.revision === right.revision,
	);

	const nowMs = useLiveNowMs([
		runtime.nextWakeAtMs,
	]);

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
		<section
			data-ui="dev sheet"
			className="max-h-[var(--ak-sheet-max-height)] min-w-0 overflow-y-auto overscroll-contain"
		>
			<SheetHeader
				title="Developer"
				description="Debug, diagnostics and runtime tools"
				onClose={onClose}
			/>
			<div className="grid min-w-0 gap-3 p-4 pt-3">
				<section className="rounded-sm border border-pink-200 bg-white min-w-0 overflow-hidden p-3">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
						<div>
							<p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-fuchsia-700">
								Bug report
							</p>
							<h2 className="mt-1 text-base font-semibold text-ak-text">
								Copy diagnostic dump
							</h2>
							<p className="mt-2 text-sm text-ak-text-muted">
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
						<p className="mt-3 text-sm font-semibold text-emerald-800">
							Copied. Paste the JSON dump into chat with a one-line symptom.
						</p>
					) : null}
					{copyState === "failed" ? (
						<p className="mt-3 text-sm font-semibold text-rose-800">
							Copy failed. Use window.__ARKINI_BUG_REPORT__.dump() in the console.
						</p>
					) : null}
					<pre className="mt-3 max-h-36 max-w-full overflow-auto whitespace-pre-wrap break-words rounded-sm border border-pink-200 bg-pink-50/70 p-2 text-[0.65rem] text-ak-text-muted">
						{dumpPreview}
					</pre>
				</section>

				<section className="rounded-sm border border-pink-200 bg-white min-w-0 overflow-hidden p-3">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
						<div>
							<p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-violet-700">
								Scenarios
							</p>
							<h2 className="mt-1 text-base font-semibold text-ak-text">
								Load debug save
							</h2>
							<p className="mt-2 text-sm text-ak-text-muted">
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
					<div
						data-ui="scenario list"
						className="mt-3 grid gap-2"
					>
						{DevScenarioDefinitions.map((scenario) => (
							<button
								type="button"
								key={scenario.id}
								disabled={loadScenarioAction.isPending}
								onClick={() => loadScenario(scenario.id)}
								className="min-w-0 rounded-sm border border-pink-200 bg-white/70 px-3 py-2 text-left transition hover:border-fuchsia-300/70 hover:bg-fuchsia-50/60 disabled:cursor-wait disabled:opacity-60"
							>
								<span className="block break-words text-sm font-bold text-ak-text">
									{scenario.label}
								</span>
								<span className="mt-1 block break-words text-xs text-ak-text-muted">
									{scenario.description}
								</span>
							</button>
						))}
					</div>
					{loadScenarioAction.data ? (
						<p className="mt-3 text-sm font-semibold text-violet-800">
							Loaded {loadScenarioAction.data.scenarioId}. Reproduce the bug, then
							copy a bug report.
						</p>
					) : null}
					{loadScenarioAction.isError ? (
						<p className="mt-3 text-sm font-semibold text-rose-800">
							Scenario load failed. Check the console; naturally, even debugging needs
							debugging.
						</p>
					) : null}
				</section>

				<section className="rounded-sm border border-pink-200 bg-white min-w-0 overflow-hidden p-3">
					<div className="flex h-full min-w-0 flex-wrap items-center gap-4">
						<div className="min-w-0">
							<p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-violet-700">
								Runtime
							</p>
							<h2 className="mt-1 text-base font-semibold text-ak-text">
								Local session
							</h2>
							<span className="mt-2 inline-flex rounded-sm bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
								dexie-save
							</span>
						</div>

						<div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
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
								value={formatWake(runtime.nextWakeAtMs, nowMs)}
							/>
							<StatusPill
								label="Source"
								value="Dexie save"
							/>
						</div>

						<div className="min-w-0">
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
								<p className="mt-3 text-sm text-rose-800">
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
