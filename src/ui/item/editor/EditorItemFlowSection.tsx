import { useEffect, useMemo, useState } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import type { EditorOriginFlowSelection } from "~/ui/item/editor/readEditorOriginFlowHighlight";
import { EditorOriginFlowCanvas } from "~/ui/item/editor/EditorOriginFlowCanvas";
import type {
	EditorItemOriginFlowLayoutNode,
	EditorItemOriginFlowLayoutPoint,
} from "~/ui/item/editor/layoutEditorItemOriginFlow";
import { useEditorItemOriginFlow } from "~/ui/item/editor/useEditorItemOriginFlow";

const EmptyFlowPositions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode> = new Map();
const EmptyFlowRoutes: ReadonlyMap<
	string,
	ReadonlyArray<EditorItemOriginFlowLayoutPoint>
> = new Map();

interface EditorOriginFlowSectionProps {
	readonly itemId?: string;
	readonly mode: "all" | "item";
}

/** Visualizes either the complete game graph or every provenance path to starter roots. */
export const EditorOriginFlowSection = ({ itemId, mode }: EditorOriginFlowSectionProps) => {
	const project = useEditorProject();
	const flowState = useEditorItemOriginFlow(project.config, itemId);
	const flow = flowState.flow;
	const positions = flowState.status === "ready" ? flowState.positions : EmptyFlowPositions;
	const routes = flowState.status === "ready" ? flowState.routes : EmptyFlowRoutes;
	const [selection, setSelection] = useState<EditorOriginFlowSelection>();
	useEffect(() => {
		setSelection(undefined);
	}, [
		flow,
	]);
	const isReady = flowState.status === "ready" && flow !== undefined;
	const badge = useMemo(() => {
		if (isReady) {
			if (mode === "all")
				return {
					label: `${flow.nodes.filter(({ kind }) => kind === "item").length} items`,
					toneClass: "border-violet-400 bg-violet-100 text-violet-900",
				};
			return flow.obtainable
				? {
						label: "Obtainable",
						toneClass: "border-violet-400 bg-violet-100 text-violet-900",
					}
				: {
						label: "No complete starter path",
						toneClass: "border-rose-300 bg-rose-50 text-rose-800",
					};
		}
		return flowState.status === "error"
			? {
					label: "Build failed",
					toneClass: "border-rose-300 bg-rose-50 text-rose-800",
				}
			: {
					label: `${flowState.progress.percent}%`,
					toneClass: "border-violet-200 bg-violet-50 text-violet-800",
				};
	}, [
		flow,
		flowState.progress.percent,
		flowState.status,
		isReady,
		mode,
	]);

	return (
		<section
			className="h-full min-h-[34rem] overflow-hidden rounded-lg border border-l-2 border-line bg-surface-raised"
			data-ui="EditorOriginFlowSection"
		>
			{isReady ? (
				<div className="relative h-full min-h-0 bg-canvas">
					<div className="pointer-events-none absolute right-3 top-3 z-10">
						<span
							className={`rounded-full border px-3 py-1 text-sm font-semibold shadow-sm ${badge.toneClass}`}
						>
							{badge.label}
						</span>
					</div>
					<EditorOriginFlowCanvas
						fitContent={mode === "item"}
						flow={flow}
						onSelectionChange={setSelection}
						positions={positions}
						routes={routes}
						selection={selection}
					/>
				</div>
			) : (
				<div className="grid h-full place-items-center p-8">
					<div className="flex max-w-md flex-col items-center gap-3 text-center">
						<span
							className={`${
								flowState.status === "error"
									? "icon-[lucide--triangle-alert] text-rose-600"
									: "icon-[lucide--loader-circle] animate-spin text-violet-700"
							} size-9`}
						/>
						<strong>
							{flowState.status === "error"
								? mode === "all"
									? "Game graph build failed"
									: "Acquisition graph build failed"
								: mode === "all"
									? "Building game graph"
									: "Building acquisition graph"}
						</strong>
						<span className="text-sm text-muted">{flowState.progress.label}</span>
						{flowState.status === "loading" ? (
							<>
								<div className="h-1.5 w-64 overflow-hidden rounded-full bg-violet-100">
									<div
										className="h-full rounded-full bg-violet-500"
										style={{
											width: `${flowState.progress.percent}%`,
										}}
									/>
								</div>
								<span className="font-mono text-xs text-muted">
									{flowState.progress.percent}%
								</span>
							</>
						) : null}
					</div>
				</div>
			)}
		</section>
	);
};

export const EditorItemFlowSection = ({ itemId }: { readonly itemId: string }) => (
	<div className="h-[calc(100vh-7rem)]">
		<EditorOriginFlowSection
			itemId={itemId}
			mode="item"
		/>
	</div>
);
