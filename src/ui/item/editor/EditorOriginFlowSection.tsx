import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import type {
	EditorOriginFlowDirection,
	EditorOriginFlowSelection,
} from "~/ui/item/editor/readEditorOriginFlowHighlightFx";
import { EditorOriginFlowCanvas } from "~/ui/item/editor/EditorOriginFlowCanvas";
import type {
	EditorItemOriginFlowLayoutNode,
	EditorItemOriginFlowLayoutPoint,
} from "~/ui/item/editor/editorItemOriginFlowLayout";
import { useEditorItemOriginFlow } from "~/ui/item/editor/useEditorItemOriginFlow";

const EmptyFlowBackbones: ReadonlyMap<
	string,
	ReadonlyArray<EditorItemOriginFlowLayoutPoint>
> = new Map();
const EmptyFlowPositions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode> = new Map();

interface EditorOriginFlowSectionProps {
	readonly direction?: EditorOriginFlowDirection;
	readonly focusItemId?: string;
	readonly focusRequestKey?: number;
}

/** Renders the complete authored game graph and focuses one existing item node. */
export const EditorOriginFlowSection = ({
	direction = "input",
	focusItemId,
	focusRequestKey,
}: EditorOriginFlowSectionProps) => {
	const project = useEditorProject();
	const navigate = useNavigate();
	const flowState = useEditorItemOriginFlow(project.config);
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
		return flow.nodes.find((node) => node.itemId === focusItemId)?.id;
	}, [
		flow,
		focusItemId,
		isReady,
	]);
	useEffect(() => {
		setSelection(
			focusNodeId === undefined
				? undefined
				: {
						id: focusNodeId,
						kind: "node",
					},
		);
	}, [
		focusNodeId,
		focusRequestKey,
	]);
	const openItem = useCallback(
		(itemId: string) => {
			const item = project.config.items[itemId];
			if (item === undefined) return;
			void navigate({
				to: "/editor/$projectId/editor/items/$itemUid/detail/$sectionId",
				params: {
					itemUid: item.uid,
					projectId: project.projectId,
					sectionId: "identity",
				},
			});
		},
		[
			navigate,
			project.config.items,
			project.projectId,
		],
	);

	return (
		<section
			className="h-full min-h-[34rem] overflow-hidden rounded-lg border border-l-2 border-line bg-surface-raised"
			data-ui="EditorOriginFlowSection"
		>
			{isReady ? (
				<div className="relative h-full min-h-0 bg-canvas">
					<EditorOriginFlowCanvas
						backbones={backbones}
						direction={direction}
						fitContent={false}
						flow={flow}
						focusNodeId={focusNodeId}
						focusRequestKey={focusRequestKey}
						onSelectionChange={setSelection}
						onItemOpen={openItem}
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
