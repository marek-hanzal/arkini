import {
	Background,
	Controls,
	Handle,
	MarkerType,
	Position,
	ReactFlow,
	type Edge,
	type Node,
	type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import {
	type EditorItemOriginItemNode,
	type EditorItemOriginNodeStatus,
	type EditorItemOriginSourceNode,
} from "~/bridge/item/editor/readEditorItemOriginFlow";
import { ItemTypeLabel } from "~/ui/item-detail/ItemInfoPresentation";
import { EditorItemThumbnail } from "~/ui/item/editor/EditorItemThumbnail";
import { layoutEditorItemOriginFlow } from "~/ui/item/editor/layoutEditorItemOriginFlow";
import { useEditorItemOriginFlow } from "~/ui/item/editor/useEditorItemOriginFlow";
import { Tooltip } from "~/ui/overlay/Tooltip";

interface ItemNodeData extends Record<string, unknown> {
	readonly itemId: string;
	readonly resourceIds: EditorItemOriginItemNode["resourceIds"];
	readonly starterScopes: EditorItemOriginItemNode["starterScopes"];
	readonly status: EditorItemOriginNodeStatus;
	readonly title: string;
	readonly typeLabel: string;
}

interface SourceNodeData extends Record<string, unknown> {
	readonly label: string;
	readonly originBadges: ReadonlyArray<OriginBadgeData>;
	readonly status: Exclude<EditorItemOriginNodeStatus, "starter">;
}

interface OriginBadgeData {
	readonly icon: string;
	readonly label: string;
	readonly tooltip: string;
}

type ItemFlowNode = Node<ItemNodeData, "item">;
type SourceFlowNode = Node<SourceNodeData, "source">;
type FlowNode = ItemFlowNode | SourceFlowNode;

const StatusClassName: Record<EditorItemOriginNodeStatus, string> = {
	starter: "border-violet-500 bg-violet-100",
	reachable: "border-violet-300 bg-violet-50",
	blocked: "border-rose-300 bg-rose-50",
	cycle: "border-amber-400 bg-amber-50",
};

const FlowHandles = () => (
	<>
		<Handle
			className="opacity-0"
			position={Position.Left}
			type="target"
		/>
		<Handle
			className="opacity-0"
			position={Position.Right}
			type="source"
		/>
	</>
);

const ItemNode = ({ data }: NodeProps<ItemFlowNode>) => (
	<div
		className={`min-w-56 rounded-lg border border-l-2 p-3 shadow-sm ${StatusClassName[data.status]}`}
		data-ui="EditorItemFlowItemNode"
	>
		<FlowHandles />
		<div className="flex items-center gap-3">
			<EditorItemThumbnail
				className="size-12 shrink-0"
				resourceIds={data.resourceIds}
			/>
			<div className="min-w-0">
				<strong className="block truncate text-sm">{data.title}</strong>
				<span className="block truncate font-mono text-xs text-muted">{data.itemId}</span>
				<span className="block text-[0.65rem] font-semibold uppercase tracking-wider text-muted">
					{data.starterScopes.length > 0
						? `Starter: ${data.starterScopes.join(", ")}`
						: data.typeLabel}
				</span>
			</div>
		</div>
	</div>
);

const OriginBadge = ({ icon, label, tooltip }: OriginBadgeData) => (
	<Tooltip content={tooltip}>
		<span className="inline-flex items-center gap-1 rounded-full border border-violet-300 bg-violet-100 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-violet-900">
			<span className={`${icon} size-3.5`} />
			{label}
		</span>
	</Tooltip>
);

const SourceNode = ({ data }: NodeProps<SourceFlowNode>) => (
	<div
		className={`min-w-48 rounded-lg border border-l-2 px-4 py-3 ${StatusClassName[data.status]}`}
		data-ui="EditorItemFlowSourceNode"
	>
		<FlowHandles />
		<strong className="block max-w-52 truncate text-sm">{data.label}</strong>
		<div className="mt-2 flex max-w-64 flex-wrap gap-1.5">
			{data.originBadges.map((badge) => (
				<OriginBadge
					key={`${badge.label}:${badge.tooltip}`}
					{...badge}
				/>
			))}
		</div>
	</div>
);

const nodeTypes = {
	item: ItemNode,
	source: SourceNode,
};

const SourceKindBadge: Record<"line" | "charges" | "merge" | "expiry", OriginBadgeData> = {
	line: {
		icon: "icon-[lucide--factory]",
		label: "Production",
		tooltip: "Produced by completing this item's production line.",
	},
	charges: {
		icon: "icon-[lucide--battery-warning]",
		label: "Depletion",
		tooltip: "Emitted when the source item spends its final charge.",
	},
	merge: {
		icon: "icon-[lucide--combine]",
		label: "Merge",
		tooltip: "Created by resolving a configured merge with the required target item.",
	},
	expiry: {
		icon: "icon-[lucide--timer-off]",
		label: "Expiry",
		tooltip: "Emitted when the source temporary item's lifetime ends.",
	},
};

const SelectionKindBadge: Record<
	"guaranteed" | "chance" | "weighted" | "replace",
	OriginBadgeData
> = {
	guaranteed: {
		icon: "icon-[lucide--circle-check-big]",
		label: "Guaranteed",
		tooltip: "This roll emits the item whenever its rules allow the drop.",
	},
	chance: {
		icon: "icon-[lucide--percent]",
		label: "Chance",
		tooltip: "This roll emits the item only when its configured probability succeeds.",
	},
	weighted: {
		icon: "icon-[lucide--dices]",
		label: "Weighted",
		tooltip: "This item is one candidate selected according to relative roll weights.",
	},
	replace: {
		icon: "icon-[lucide--replace]",
		label: "Replacement",
		tooltip: "This item replaces the merge target when the merge resolves.",
	},
};

const readOriginBadges = (node: EditorItemOriginSourceNode): OriginBadgeData[] => [
	SourceKindBadge[node.sourceKind],
	...(node.weightedSet
		? [
				{
					icon: "icon-[lucide--layers-3]",
					label: "Weighted set",
					tooltip:
						"The output set containing this item competes with other sets by relative weight.",
				},
			]
		: []),
	SelectionKindBadge[node.selectionKind],
	...(node.placement === undefined
		? []
		: node.placement === "random"
			? [
					{
						icon: "icon-[lucide--shuffle]",
						label: "Random board",
						tooltip: "The emitted item starts its board placement from a random space.",
					},
				]
			: [
					{
						icon: "icon-[lucide--map-pin]",
						label: "Local drop",
						tooltip: "The emitted item is placed nearest to the source item first.",
					},
				]),
];

interface EditorOriginFlowSectionProps {
	readonly itemId?: string;
	readonly mode: "all" | "item";
}

/** Visualizes either the complete game graph or every provenance path to starter roots. */
export const EditorOriginFlowSection = ({ itemId, mode }: EditorOriginFlowSectionProps) => {
	const navigate = useNavigate();
	const project = useEditorProject();
	const flowState = useEditorItemOriginFlow(project.config, itemId);
	const flow = flowState.flow;
	const items = useMemo(
		() =>
			new Map(
				Object.values(project.config.items).map((item) => [
					item.id,
					item,
				]),
			),
		[
			project.config.items,
		],
	);
	const nodes = useMemo<FlowNode[]>(() => {
		if (flow === undefined) return [];
		const positions = layoutEditorItemOriginFlow(flow);
		return flow.nodes.map((node) => {
			const layoutNode = positions.get(node.id);
			if (layoutNode === undefined) throw new Error(`Missing layout for ${node.id}.`);
			const position = {
				x: layoutNode.x,
				y: layoutNode.y,
			};
			if (node.kind === "item") {
				return {
					data: {
						itemId: node.itemId,
						resourceIds: node.resourceIds,
						starterScopes: node.starterScopes,
						status: node.status,
						title: node.title,
						typeLabel:
							node.type === "missing" ? "Missing item" : ItemTypeLabel[node.type],
					},
					id: node.id,
					initialHeight: layoutNode.height,
					initialWidth: layoutNode.width,
					origin: [
						0,
						0,
					],
					position,
					type: "item" as const,
				};
			}
			return {
				data: {
					label: node.label,
					originBadges: readOriginBadges(node),
					status: node.status,
				},
				id: node.id,
				initialHeight: layoutNode.height,
				initialWidth: layoutNode.width,
				origin: [
					0,
					0,
				],
				position,
				type: "source" as const,
			};
		});
	}, [
		flow,
	]);
	const edges = useMemo<Edge[]>(
		() =>
			(flow?.edges ?? []).map((edge) => ({
				...edge,
				markerEnd: {
					type: MarkerType.ArrowClosed,
				},
				style: {
					stroke: "#8b5a9f",
					strokeWidth: 2,
				},
				type: "smoothstep",
			})),
		[
			flow,
		],
	);
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
							? "Shows every item and the operations that connect its inputs to outputs."
							: "Shows every acquisition path back to starter board, inventory or toolbar items."}
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
							: flow?.obtainable
								? "Obtainable"
								: "No complete starter path"
						: flowState.status === "error"
							? "Build failed"
							: `${flowState.progress.percent}%`}
				</span>
			</header>
			{isReady ? (
				<div className="relative min-h-0">
					<ReactFlow<FlowNode, Edge>
						defaultViewport={{
							x: 24,
							y: 24,
							zoom: 0.75,
						}}
						edges={edges}
						fitView={mode === "item"}
						fitViewOptions={{
							padding: 0.12,
						}}
						maxZoom={1.4}
						minZoom={0.2}
						nodes={nodes}
						nodesConnectable={false}
						nodesDraggable={false}
						nodeTypes={nodeTypes}
						onlyRenderVisibleElements
						onNodeClick={(_event, node) => {
							if (node.type !== "item" || node.data.itemId === itemId) return;
							const target = items.get(node.data.itemId);
							if (target === undefined) return;
							void navigate({
								to: "/editor/$projectId/editor/items/$itemUid/detail/$sectionId",
								params: {
									projectId: project.projectId,
									itemUid: target.uid,
									sectionId: "flow",
								},
							});
						}}
						proOptions={{
							hideAttribution: true,
						}}
					>
						<Background gap={24} />
						<Controls showInteractive={false} />
					</ReactFlow>
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
