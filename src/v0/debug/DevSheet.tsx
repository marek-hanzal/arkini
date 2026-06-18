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

const debugButtonToneClassName: Record<"primary" | "neutral" | "danger", string> = {
	danger: "border-rose-400/70 bg-rose-950/30 text-rose-200 hover:border-rose-300 hover:bg-rose-900/40",
	neutral:
		"border-ak-border bg-ak-surface-soft text-ak-text hover:border-ak-border-accent hover:bg-ak-primary-soft",
	primary: "border-ak-border-accent bg-ak-primary text-white hover:bg-pink-400",
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
			"min-h-10 w-full rounded-sm border px-3 py-2 text-xs font-extrabold leading-none transition-[transform,border-color,background,color,opacity] active:translate-y-px disabled:cursor-wait disabled:opacity-45",
			debugButtonToneClassName[tone],
		)}
	>
		{children}
	</button>
);

export const DevSheet: FC<DevSheet.Props> = ({ onClose }) => {
	const loadScenarioAction = useLoadDevScenarioAction();
	const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
	const [resetState, setResetState] = useState<"idle" | "pending" | "failed">("idle");
	const [timelineSize, setTimelineSize] = useState(DebugTimeline.entries().length);
	const runtimeRevision = useGameRuntimeSelector((state) => state.revision);

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
		runtimeRevision,
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
			className="min-h-0 overflow-hidden"
		>
			<SheetHeader
				title="Developer"
				onClose={onClose}
			/>
			<div className="mx-auto grid w-full max-w-[430px] gap-3 px-2 py-3">
				<section className="min-w-0 overflow-hidden rounded-sm border border-ak-border bg-ak-surface-elevated p-3">
					<div>
						<p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-ak-primary">
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
					<div className="mt-3 grid grid-cols-2 gap-2">
						<DebugButton
							tone="primary"
							onClick={copyBugReport}
						>
							Copy bug report
						</DebugButton>
						<DebugButton onClick={clearTimeline}>Clear timeline</DebugButton>
					</div>
					<div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
						<StatusPill
							label="Timeline"
							value={String(timelineSize)}
						/>
						<StatusPill
							label="Revision"
							value={String(runtimeRevision)}
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
						<p className="mt-3 text-sm font-semibold text-emerald-300">
							Copied. Paste the JSON dump into chat with a one-line symptom.
						</p>
					) : null}
					{copyState === "failed" ? (
						<p className="mt-3 text-sm font-semibold text-rose-300">
							Copy failed. Use window.__ARKINI_BUG_REPORT__.dump() in the console.
						</p>
					) : null}
					<pre className="mt-3 max-h-36 max-w-full overflow-auto whitespace-pre-wrap break-words rounded-sm border border-ak-border bg-ak-surface-soft p-2 text-[0.65rem] text-ak-text-muted [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
						{dumpPreview}
					</pre>
				</section>

				<section className="min-w-0 overflow-hidden rounded-sm border border-ak-border bg-ak-surface-elevated p-3">
					<div>
						<p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-ak-primary">
							Scenarios
						</p>
						<h2 className="mt-1 text-base font-semibold text-ak-text">
							Load debug save
						</h2>
						<p className="mt-2 text-sm text-ak-text-muted">
							Reset the runtime save into a deterministic state before reproducing an
							animation bug. The loaded scenario is recorded into the bug report
							timeline.
						</p>
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
								className="min-w-0 rounded-sm border border-ak-border bg-ak-surface-soft px-3 py-2 text-left transition hover:border-ak-border-accent hover:bg-ak-primary-soft disabled:cursor-wait disabled:opacity-60"
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
						<p className="mt-3 text-sm font-semibold text-emerald-300">
							Loaded {loadScenarioAction.data.scenarioId}. Reproduce the bug, then
							copy a bug report.
						</p>
					) : null}
					{loadScenarioAction.isError ? (
						<p className="mt-3 text-sm font-semibold text-rose-300">
							Scenario load failed. Check the console; naturally, even debugging needs
							debugging.
						</p>
					) : null}
				</section>

				<section className="min-w-0 overflow-hidden rounded-sm border border-ak-border bg-ak-surface-elevated p-3">
					<p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-ak-primary">
						Storage reset
					</p>
					<div className="mt-3">
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
							<p className="mt-3 text-sm text-rose-300">
								Reset failed. Check the console.
							</p>
						) : null}
					</div>
				</section>
			</div>
		</section>
	);
};
