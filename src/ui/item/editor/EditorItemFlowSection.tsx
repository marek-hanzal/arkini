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
import { useEffect, useMemo, useState } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import {
	type EditorItemOriginItemNode,
	type EditorItemOriginNodeStatus,
	type EditorItemOriginSourceNode,
} from "~/bridge/item/editor/readEditorItemOriginFlow";
import { ItemTypeLabel } from "~/ui/item-detail/ItemInfoPresentation";
import { EditorItemThumbnail } from "~/ui/item/editor/EditorItemThumbnail";
import type { EditorItemOriginFlowLayoutNode } from "~/ui/item/editor/layoutEditorItemOriginFlow";
import {
	type EditorOriginFlowSelection,
	readEditorOriginFlowHighlight,
} from "~/ui/item/editor/readEditorOriginFlowHighlight";
import { useEditorItemOriginFlow } from "~/ui/item/editor/useEditorItemOriginFlow";
import { Tooltip } from "~/ui/overlay/Tooltip";

interface ItemNodeData extends Record<string, unknown> {
	readonly highlight: FlowNodeHighlight;
	readonly itemId: string;
	readonly itemType: EditorItemOriginItemNode["type"];
	readonly resourceIds: EditorItemOriginItemNode["resourceIds"];
	readonly starterScopes: EditorItemOriginItemNode["starterScopes"];
	readonly status: EditorItemOriginNodeStatus;
	readonly title: string;
	readonly typeLabel: string;
}

interface SourceNodeData extends Record<string, unknown> {
	readonly highlight: FlowNodeHighlight;
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
type FlowNodeHighlight = "active" | "idle" | "selected";

const EmptyFlowPositions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode> = new Map();
const DefaultFlowViewport = {
	x: 24,
	y: 24,
	zoom: 0.75,
} as const;

const FlowNodeHighlightClassName: Record<FlowNodeHighlight, string> = {
	active: "!opacity-100 outline-2 outline-violet-500 outline-offset-2",
	idle: "",
	selected: "!opacity-100 outline-4 outline-violet-600 outline-offset-2",
};

const readFlowNodeHighlight = (
	nodeId: string,
	selection: EditorOriginFlowSelection | undefined,
	highlight: ReturnType<typeof readEditorOriginFlowHighlight> | undefined,
): FlowNodeHighlight => {
	if (highlight === undefined) return "idle";
	if (selection?.kind === "node" && selection.id === nodeId) return "selected";
	return highlight.nodeIds.has(nodeId) ? "active" : "idle";
};

const SourceStatusClassName: Record<EditorItemOriginNodeStatus, string> = {
	starter: "border-violet-500 bg-violet-100",
	reachable: "border-violet-300 bg-violet-50",
	blocked: "border-rose-300 bg-rose-50",
	cycle: "border-amber-400 bg-amber-50",
};

const ItemTypeClassName: Record<EditorItemOriginItemNode["type"], string> = {
	blueprint: "border-fuchsia-300 bg-fuchsia-50",
	craft: "border-orange-300 bg-orange-50",
	deposit: "border-amber-300 bg-amber-50",
	inventory: "border-sky-300 bg-sky-50",
	missing: "border-red-400 bg-red-50",
	producer: "border-violet-400 bg-violet-50",
	simple: "border-slate-300 bg-slate-50",
	stash: "border-cyan-300 bg-cyan-50",
	temporary: "border-rose-300 bg-rose-50",
};

const ItemStatusClassName: Record<EditorItemOriginNodeStatus, string> = {
	starter: "ring-2 ring-violet-500",
	reachable: "ring-1 ring-black/5",
	blocked: "ring-2 ring-rose-400",
	cycle: "ring-2 ring-amber-400",
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

/** Seeds handle bounds so React Flow can cull offscreen nodes before their first DOM mount. */
const readFlowNodeHandles = ({
	height,
	width,
}: EditorItemOriginFlowLayoutNode): NonNullable<FlowNode["handles"]> => [
	{
		height: 6,
		position: Position.Left,
		type: "target",
		width: 6,
		x: -3,
		y: height / 2 - 3,
	},
	{
		height: 6,
		position: Position.Right,
		type: "source",
		width: 6,
		x: width - 3,
		y: height / 2 - 3,
	},
];

const ItemNode = ({ data }: NodeProps<ItemFlowNode>) => (
	<div
		className={`ak-flow-node-card min-h-[4.75rem] w-56 rounded-lg border border-l-2 p-3 shadow-sm transition-[opacity,outline] ${ItemTypeClassName[data.itemType]} ${ItemStatusClassName[data.status]} ${FlowNodeHighlightClassName[data.highlight]}`}
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
		className={`ak-flow-node-card min-h-28 w-64 rounded-2xl border border-l-2 px-4 py-3 shadow-sm transition-[opacity,outline] ${SourceStatusClassName[data.status]} ${FlowNodeHighlightClassName[data.highlight]}`}
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
	const project = useEditorProject();
	const flowState = useEditorItemOriginFlow(project.config, itemId);
	const flow = flowState.flow;
	const positions = flowState.status === "ready" ? flowState.positions : EmptyFlowPositions;
	const [selection, setSelection] = useState<EditorOriginFlowSelection>();
	const [moving, setMoving] = useState(false);
	useEffect(() => {
		setMoving(false);
		setSelection(undefined);
	}, [
		flow,
	]);
	const highlight = useMemo(
		() =>
			flow === undefined || selection === undefined
				? undefined
				: readEditorOriginFlowHighlight(flow, positions, selection),
		[
			flow,
			positions,
			selection,
		],
	);
	const baseNodes = useMemo<FlowNode[]>(() => {
		if (flow === undefined) return [];
		return flow.nodes.map((node) => {
			const layoutNode = positions.get(node.id);
			if (layoutNode === undefined) throw new Error(`Missing layout for ${node.id}.`);
			const position = {
				x: layoutNode.x,
				y: layoutNode.y,
			};
			if (node.kind === "item") {
				return {
					className: "cursor-pointer",
					data: {
						highlight: "idle",
						itemId: node.itemId,
						itemType: node.type,
						resourceIds: node.resourceIds,
						starterScopes: node.starterScopes,
						status: node.status,
						title: node.title,
						typeLabel:
							node.type === "missing" ? "Missing item" : ItemTypeLabel[node.type],
					},
					handles: readFlowNodeHandles(layoutNode),
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
				className: "cursor-pointer",
				data: {
					highlight: "idle",
					label: node.label,
					originBadges: readOriginBadges(node),
					status: node.status,
				},
				handles: readFlowNodeHandles(layoutNode),
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
		positions,
	]);
	const nodes = useMemo<FlowNode[]>(() => {
		if (highlight === undefined) return baseNodes;
		return baseNodes.map((node) => {
			const nodeHighlight = readFlowNodeHighlight(node.id, selection, highlight);
			if (nodeHighlight === "idle") return node;
			return {
				...node,
				data: {
					...node.data,
					highlight: nodeHighlight,
				},
			};
		}) as FlowNode[];
	}, [
		baseNodes,
		highlight,
		selection,
	]);
	const baseEdges = useMemo<Edge[]>(
		() =>
			(flow?.edges ?? []).map((edge) => ({
				...edge,
				className: "ak-flow-edge cursor-pointer opacity-50",
				markerEnd: {
					color: "#7c3aed",
					type: MarkerType.ArrowClosed,
				},
				style: {
					stroke: "#7c3aed",
					strokeWidth: 1.5,
				},
				type: "smoothstep",
			})),
		[
			flow,
		],
	);
	const edges = useMemo<Edge[]>(() => {
		if (highlight === undefined) return baseEdges;
		return baseEdges.map((edge) => {
			if (!highlight.edgeIds.has(edge.id)) return edge;
			return {
				...edge,
				className: `${edge.className ?? ""} !opacity-100`,
				style: {
					...edge.style,
					strokeWidth: selection?.kind === "edge" && selection.id === edge.id ? 5 : 4,
				},
			};
		});
	}, [
		baseEdges,
		highlight,
		selection,
	]);
	const renderedEdges = useMemo(
		() =>
			moving
				? highlight === undefined
					? []
					: edges.filter((edge) => highlight.edgeIds.has(edge.id))
				: edges,
		[
			edges,
			highlight,
			moving,
		],
	);
	const isReady = flowState.status === "ready" && flow !== undefined;
	return (
		<section
			className={`grid h-full min-h-[34rem] grid-rows-[auto_1fr] overflow-hidden rounded-lg border border-l-2 border-line bg-surface-raised ${
				selection === undefined
					? ""
					: "[&_.ak-flow-edge]:opacity-10 [&_.ak-flow-node-card]:opacity-20"
			}`}
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
						defaultViewport={DefaultFlowViewport}
						edges={renderedEdges}
						fitView={mode === "item"}
						fitViewOptions={{
							padding: 0.12,
						}}
						maxZoom={1.4}
						minZoom={0.2}
						nodes={nodes}
						elementsSelectable={false}
						nodesConnectable={false}
						nodesDraggable={false}
						nodeTypes={nodeTypes}
						onlyRenderVisibleElements
						onEdgeClick={(_event, edge) => {
							setSelection((current) =>
								current?.kind === "edge" && current.id === edge.id
									? undefined
									: {
											id: edge.id,
											kind: "edge",
										},
							);
						}}
						onNodeClick={(_event, node) => {
							setSelection((current) =>
								current?.kind === "node" && current.id === node.id
									? undefined
									: {
											id: node.id,
											kind: "node",
										},
							);
						}}
						onMoveEnd={() => setMoving(false)}
						onMoveStart={() => setMoving(true)}
						onPaneClick={() => setSelection(undefined)}
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
