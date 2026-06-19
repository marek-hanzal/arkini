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
import { useGameRuntimeSelector } from "~/v0/play/runtime";
import { SheetHeader } from "~/v0/play/sheet/SheetHeader";
import { UiButton } from "~/v0/ui/UiButton";
import { UiSection } from "~/v0/ui/UiSection";

export namespace DevSheet {
	export interface Props {
		onClose(): void;
	}
}

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
			className="flex max-h-[var(--ak-sheet-max-height)] min-h-0 w-full flex-col overflow-hidden bg-ak-surface"
		>
			<SheetHeader
				title="Developer"
				onClose={onClose}
			/>
			<div className="mx-auto grid min-h-0 w-full max-w-[460px] flex-1 gap-3 overflow-y-auto overscroll-contain px-3 py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
				<UiSection
					eyebrow="Bug report"
					title="Copy diagnostic dump"
				>
					<p className="text-sm leading-6 text-ak-text-muted">
						One JSON packet with browser metadata, runtime diagnostics and the latest
						debug timeline. Paste it into chat after reproducing a bug.
					</p>
					<div className="mt-3 grid grid-cols-2 gap-2">
						<UiButton
							tone="primary"
							onClick={copyBugReport}
						>
							Copy bug report
						</UiButton>
						<UiButton onClick={clearTimeline}>Clear timeline</UiButton>
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
					<pre className="mt-3 max-h-40 max-w-full overflow-auto whitespace-pre-wrap break-words rounded-sm bg-ak-surface px-3 py-2 text-[0.7rem] leading-5 text-ak-text-muted [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
						{dumpPreview}
					</pre>
				</UiSection>

				<UiSection
					eyebrow="Scenarios"
					title="Load debug save"
				>
					<p className="text-sm leading-6 text-ak-text-muted">
						Reset the runtime save into a deterministic state before reproducing an
						animation bug. The loaded scenario is recorded into the bug report timeline.
					</p>
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
								className="min-w-0 rounded-sm border border-ak-border bg-ak-surface px-3 py-2.5 text-left transition hover:border-ak-border-accent hover:bg-ak-surface-soft disabled:cursor-wait disabled:opacity-60"
							>
								<span className="block break-words text-sm font-bold text-ak-text">
									{scenario.label}
								</span>
								<span className="mt-1 block break-words text-sm leading-5 text-ak-text-muted">
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
							Scenario load failed. Check the console.
						</p>
					) : null}
				</UiSection>

				<UiSection
					eyebrow="Storage reset"
					title="Nuke local save"
				>
					<UiButton
						tone="danger"
						disabled={resetState === "pending"}
						onClick={hardReset}
					>
						{resetState === "pending"
							? "Dropping browser storage…"
							: "Hard reset storage"}
					</UiButton>
					{resetState === "failed" ? (
						<p className="mt-3 text-sm text-rose-300">
							Reset failed. Check the console.
						</p>
					) : null}
				</UiSection>
			</div>
		</section>
	);
};
