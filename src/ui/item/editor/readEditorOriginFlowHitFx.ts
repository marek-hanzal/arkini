import { Effect } from "effect";

import type { EditorItemOriginFlow } from "~/bridge/item/editor/readEditorItemOriginFlowFx";
import type {
	EditorItemOriginFlowLayoutNode,
	EditorItemOriginFlowLayoutPoint,
} from "~/ui/item/editor/editorItemOriginFlowLayout";
import type { EditorOriginFlowConnectedPorts } from "~/ui/item/editor/readEditorOriginFlowConnectedPortsFx";
import type {
	EditorOriginFlowHighlight,
	EditorOriginFlowSelection,
} from "~/ui/item/editor/readEditorOriginFlowHighlightFx";
import type { EditorOriginFlowNodeMetrics } from "~/ui/item/editor/readEditorOriginFlowNodeMetricsFx";

export type EditorOriginFlowHit =
	| EditorOriginFlowSelection
	| {
			readonly kind: "port";
			readonly targetNodeId: string;
	  };

const distanceToSegment = (
	x: number,
	y: number,
	start: EditorItemOriginFlowLayoutPoint,
	end: EditorItemOriginFlowLayoutPoint,
) => {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	if (dx === 0 && dy === 0) return Math.hypot(x - start.x, y - start.y);
	const t = Math.max(
		0,
		Math.min(1, ((x - start.x) * dx + (y - start.y) * dy) / (dx * dx + dy * dy)),
	);
	return Math.hypot(x - (start.x + t * dx), y - (start.y + t * dy));
};

const distanceToRoute = (
	x: number,
	y: number,
	points: ReadonlyArray<EditorItemOriginFlowLayoutPoint>,
) => {
	let distance = Number.POSITIVE_INFINITY;
	for (let index = 1; index < points.length; index += 1)
		distance = Math.min(distance, distanceToSegment(x, y, points[index - 1]!, points[index]!));
	return distance;
};

/** Resolves the topmost selectable port, node, or routed edge at one world position. */
export const readEditorOriginFlowHitFx = Effect.fn("readEditorOriginFlowHitFx")(
	({
		backbones,
		connectedPorts,
		flow,
		highlight,
		metroBackbones,
		nodeMetrics,
		positions,
		selection,
		x,
		y,
		zoom,
	}: {
		readonly backbones: ReadonlyMap<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>;
		readonly connectedPorts: EditorOriginFlowConnectedPorts;
		readonly flow: EditorItemOriginFlow;
		readonly highlight: EditorOriginFlowHighlight | undefined;
		readonly metroBackbones: ReadonlyMap<
			string,
			ReadonlyArray<EditorItemOriginFlowLayoutPoint>
		>;
		readonly nodeMetrics: ReadonlyMap<string, EditorOriginFlowNodeMetrics>;
		readonly positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>;
		readonly selection: EditorOriginFlowSelection | undefined;
		readonly x: number;
		readonly y: number;
		readonly zoom: number;
	}) =>
		Effect.sync((): EditorOriginFlowHit | undefined => {
			const isNodeRelevant = (nodeId: string) =>
				selection?.kind !== "node" || highlight?.nodeIds.has(nodeId) === true;
			const isEdgeRelevant = (edgeId: string) =>
				selection?.kind !== "node" || highlight?.edgeIds.has(edgeId) === true;
			const portTolerance = 11 / zoom;
			for (let index = flow.nodes.length - 1; index >= 0; index -= 1) {
				const node = flow.nodes[index]!;
				if (!isNodeRelevant(node.id)) continue;
				const position = positions.get(node.id);
				const metrics = nodeMetrics.get(node.id);
				if (position === undefined || metrics === undefined) continue;
				const connectedPortIds = connectedPorts.get(node.id);
				for (const [operationIndex, operation] of node.operations.entries()) {
					const operationMetrics = metrics.operations[operationIndex];
					if (operationMetrics === undefined) continue;
					for (const input of operation.inputs) {
						const localY = operationMetrics.inputPortYs.get(input.id);
						if (
							connectedPortIds?.has(input.id) === true &&
							localY !== undefined &&
							Math.hypot(x - position.x, y - (position.y + localY)) <=
								portTolerance &&
							positions.has(`item:${input.itemId}`)
						)
							return {
								kind: "port",
								targetNodeId: `item:${input.itemId}`,
							};
					}
					for (const output of operation.outputs) {
						const localY = operationMetrics.outputPortYs.get(output.id);
						if (
							connectedPortIds?.has(output.id) === true &&
							localY !== undefined &&
							Math.hypot(
								x - (position.x + position.width),
								y - (position.y + localY),
							) <= portTolerance &&
							positions.has(`item:${output.itemId}`)
						)
							return {
								kind: "port",
								targetNodeId: `item:${output.itemId}`,
							};
					}
				}
			}
			for (let index = flow.nodes.length - 1; index >= 0; index -= 1) {
				const node = flow.nodes[index]!;
				const position = positions.get(node.id);
				if (
					isNodeRelevant(node.id) &&
					position !== undefined &&
					x >= position.x &&
					x <= position.x + position.width &&
					y >= position.y &&
					y <= position.y + position.height
				)
					return {
						id: node.id,
						kind: "node",
					};
			}
			const tolerance = 9 / zoom;
			for (const metroFirst of [
				true,
				false,
			]) {
				for (const edge of flow.edges) {
					if (!isEdgeRelevant(edge.id)) continue;
					const metroBackbone = metroBackbones.get(edge.id);
					if ((metroBackbone !== undefined) !== metroFirst) continue;
					const backbone = metroBackbone ?? backbones.get(edge.id);
					if (backbone !== undefined && distanceToRoute(x, y, backbone) <= tolerance)
						return {
							id: edge.id,
							kind: "edge",
						};
				}
			}
			return undefined;
		}),
);
