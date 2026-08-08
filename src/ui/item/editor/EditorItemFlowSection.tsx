import { useEffect, useMemo, useState } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import type { EditorOriginFlowSelection } from "~/ui/item/editor/readEditorOriginFlowHighlight";
import { EditorOriginFlowCanvas } from "~/ui/item/editor/EditorOriginFlowCanvas";
import type {
	EditorItemOriginFlowLayoutNode,
	EditorItemOriginFlowLayoutPoint,
} from "~/ui/item/editor/layoutEditorItemOriginFlowFx";
import { useEditorItemOriginFlow } from "~/ui/item/editor/useEditorItemOriginFlow";

const EmptyFlowBackbones: ReadonlyMap<
	string,
	ReadonlyArray<EditorItemOriginFlowLayoutPoint>
> = new Map();
const EmptyFlowPositions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode> = new Map();
interface EditorOriginFlowSectionProps {
	readonly focusItemId?: string;
	readonly itemId?: string;
	readonly mode: "all" | "item";
}

/** Visualizes either the complete game flow or one directed item flow. */
export const EditorOriginFlowSection = ({
	focusItemId,
	itemId,
	mode,
}: EditorOriginFlowSectionProps) => {
	const project = useEditorProject();
	const flowState = useEditorItemOriginFlow(project.config, mode === "item" ? itemId : undefined);
	const flow = flowState.flow;
	const backbones = flowState.status === "ready" ? flowState.backbones : EmptyFlowBackbones;
	const positions = flowState.status === "ready" ? flowState.positions : EmptyFlowPositions;
	const [selection, setSelection] = useState<EditorOriginFlowSelection>();
	useEffect(() => {
		setSelection(undefined);
	}, [
		flow,
	]);
	const isReady = flowState.status === "ready" && flow !== undefined;
	const focusNodeId = useMemo(() => {
		if (!isReady || focusItemId === undefined) return undefined;
		return flow.nodes.find((node) => node.kind === "item" && node.itemId === focusItemId)?.id;
	}, [
		flow,
		focusItemId,
		isReady,
	]);
	useEffect(() => {
		if (focusNodeId === undefined) return;
		setSelection({
			id: focusNodeId,
			kind: "node",
		});
	}, [
		focusNodeId,
	]);

	return (
		<section
			className="h-full min-h-[34rem] overflow-hidden rounded-lg border border-l-2 border-line bg-surface-raised"
			data-ui="EditorOriginFlowSection"
		>
			{isReady ? (
				<div className="relative h-full min-h-0 bg-canvas">
					<EditorOriginFlowCanvas
						backbones={backbones}
						fitContent={mode === "item"}
						flow={flow}
						focusNodeId={focusNodeId}
						onSelectionChange={setSelection}
						positions={positions}
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
							{flowState.status === "error" ? "Flow failed" : "Building flow"}
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
			focusItemId={itemId}
			itemId={itemId}
			mode="item"
		/>
	</div>
);
