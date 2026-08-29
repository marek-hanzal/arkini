import { useNavigate } from "@tanstack/react-router";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useEditorProject } from "~/ui/editor/useEditorProject";
import type { OriginFlowDirection, Selection } from "~/flow/ui/Highlight";
import { Canvas } from "~/flow/ui/Canvas";
import type { LayoutNode, LayoutPoint } from "~/flow/worker/Layout";
import { useOriginFlow } from "~/flow/ui/useOriginFlow";

const EmptyFlowBackbones: ReadonlyMap<string, ReadonlyArray<LayoutPoint>> = new Map();
const EmptyFlowPositions: ReadonlyMap<string, LayoutNode> = new Map();

interface OriginFlowProps {
	readonly direction?: OriginFlowDirection;
	readonly focusItemId?: string;
	readonly focusRequestKey?: number;
	readonly onFocusItemChange?: (itemId: string) => Promise<void>;
}

/** Renders the complete authored game graph and focuses one existing item node. */
export const OriginFlow = ({
	direction = "input",
	focusItemId,
	focusRequestKey,
	onFocusItemChange,
}: OriginFlowProps) => {
	const project = useEditorProject();
	const navigate = useNavigate();
	const flowState = useOriginFlow(project.config);
	const flow = flowState.flow;
	const backbones = flowState.status === "ready" ? flowState.backbones : EmptyFlowBackbones;
	const positions = flowState.status === "ready" ? flowState.positions : EmptyFlowPositions;
	const [selection, setSelection] = useState<Selection>();
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
		async (itemId: string) => {
			const item = project.config.items[itemId];
			if (item === undefined) return;
			await onFocusItemChange?.(itemId);
			await navigate({
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
			onFocusItemChange,
			project.config.items,
			project.projectId,
		],
	);
	const FlowStateIcon = flowState.status === "error" ? TriangleAlert : LoaderCircle;

	return (
		<section
			className="h-full min-h-[34rem] overflow-hidden rounded-lg border border-l-2 border-line bg-surface-raised"
			data-ui="EditorOriginFlowSection"
		>
			{isReady ? (
				<div className="relative h-full min-h-0 bg-canvas">
					<Canvas
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
						<FlowStateIcon
							className={`size-9 ${flowState.status === "error" ? "text-rose-600" : "animate-spin text-violet-700"}`}
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
