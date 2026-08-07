import { useEffect, useState } from "react";

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
	return (
		<section
			className="grid h-full min-h-[34rem] grid-rows-[auto_1fr] overflow-hidden rounded-lg border border-l-2 border-line bg-surface-raised"
			data-ui="EditorOriginFlowSection"
		>
			<header className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
				<div>
					<h2 className="font-semibold">
						{mode === "all" ? "Game flow" : "Acquisition flow"}
					</h2>
					<p className="text-sm text-muted">
						{mode === "all"
							? "Shows every item and the operations that connect its inputs to outputs. Select a node or connection to trace it forward."
							: "Shows every acquisition path back to starter board, inventory or toolbar items. Select a node or connection to trace it forward."}
					</p>
				</div>
				<span
					className={`rounded-full border px-3 py-1 text-sm font-semibold ${
						isReady && flow?.obtainable
							? "border-violet-400 bg-violet-100 text-violet-900"
							: isReady
								? "border-rose-300 bg-rose-50 text-rose-800"
								: "border-violet-200 bg-violet-50 text-violet-800"
					}`}
				>
					{isReady
						? mode === "all"
							? `${flow.nodes.filter(({ kind }) => kind === "item").length} items`
							: flow.obtainable
								? "Obtainable"
								: "No complete starter path"
						: flowState.status === "error"
							? "Build failed"
							: `${flowState.progress.percent}%`}
				</span>
			</header>
			{isReady ? (
				<div className="relative min-h-0 bg-canvas">
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
				<div className="grid place-items-center p-8">
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
								? "Acquisition graph build failed"
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
