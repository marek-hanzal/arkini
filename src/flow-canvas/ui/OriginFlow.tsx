import { useNavigate } from "@tanstack/react-router";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import type { OriginFlowDirection, Selection } from "~/flow-canvas/type/Highlight";
import { Canvas } from "~/flow-canvas/ui/Canvas";
import type { LayoutNode, LayoutPoint } from "~/flow-layout/type/Layout";
import { useOriginFlow } from "~/flow-canvas/ui/useOriginFlow";
import { Status } from "~/ui/ui/Status";

const EmptyFlowBackbones: ReadonlyMap<string, ReadonlyArray<LayoutPoint>> = new Map();
const EmptyFlowPositions: ReadonlyMap<string, LayoutNode> = new Map();

interface OriginFlowProps {
	readonly direction?: OriginFlowDirection;
	readonly focusItemId?: string;
	readonly focusRequestKey?: number;
	readonly onFocusItemChangeFn?: (itemId: string) => Promise<void>;
}

/** Renders the complete authored game graph and focuses one existing item node. */
export const OriginFlow = ({
	direction = "input",
	focusItemId,
	focusRequestKey,
	onFocusItemChangeFn,
}: OriginFlowProps) => {
	const project = useEditorProject();
	const navigateFn = useNavigate();
	const flowState = useOriginFlow(project.config);
	const flow = flowState.flow;
	const backbones = flowState.status === "ready" ? flowState.backbones : EmptyFlowBackbones;
	const positions = flowState.status === "ready" ? flowState.positions : EmptyFlowPositions;
	const [selection, setSelectionFn] = useState<Selection>();
	useEffect(() => {
		setSelectionFn(undefined);
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
		setSelectionFn(
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
	const openItemFn = useCallback(
		async (itemId: string) => {
			const item = project.config.items[itemId];
			if (item === undefined) return;
			await onFocusItemChangeFn?.(itemId);
			await navigateFn({
				to: "/editor/$projectId/editor/items/$itemUid/detail/$sectionId",
				params: {
					itemUid: item.uid,
					projectId: project.projectId,
					sectionId: "identity",
				},
			});
		},
		[
			navigateFn,
			onFocusItemChangeFn,
			project.config.items,
			project.projectId,
		],
	);

	return (
		<section
			className="flex h-full min-h-0 flex-col overflow-hidden"
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
						onSelectionChangeFn={setSelectionFn}
						onItemOpenFn={openItemFn}
						positions={positions}
						selection={selection}
					/>
				</div>
			) : (
				<Status
					dataUi="EditorOriginFlowStatus"
					variant="flat"
					size="large"
					icon={flowState.status === "error" ? TriangleAlert : LoaderCircle}
					iconSpin={flowState.status === "loading"}
					title={flowState.status === "error" ? "Flow failed" : "Building flow"}
					description={
						flowState.status === "loading"
							? `${flowState.progress.label} · ${flowState.progress.percent}%`
							: flowState.progress.label
					}
				/>
			)}
		</section>
	);
};
