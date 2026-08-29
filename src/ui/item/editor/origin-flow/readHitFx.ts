import { Effect } from "effect";

import {
	EditorItemOriginItemInputPortId,
	EditorItemOriginItemOutputPortId,
	type EditorItemOriginFlow,
} from "~/editor/origin-flow/EditorItemOriginFlow";
import type { LayoutNode, LayoutPoint } from "~/ui/item/editor/origin-flow/Layout";
import type { ConnectedPorts } from "~/ui/item/editor/origin-flow/readConnectedPortsFx";
import type { Highlight, Selection } from "~/ui/item/editor/origin-flow/Highlight";
import type { NodeMetrics } from "~/ui/item/editor/origin-flow/readNodeMetricsFx";

export type Hit =
	| Selection
	| {
			readonly kind: "port";
			readonly targetNodeId: string;
	  }
	| {
			readonly itemId: string;
			readonly kind: "item-detail";
	  };

const distanceToSegment = (x: number, y: number, start: LayoutPoint, end: LayoutPoint) => {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	if (dx === 0 && dy === 0) return Math.hypot(x - start.x, y - start.y);
	const t = Math.max(
		0,
		Math.min(1, ((x - start.x) * dx + (y - start.y) * dy) / (dx * dx + dy * dy)),
	);
	return Math.hypot(x - (start.x + t * dx), y - (start.y + t * dy));
};

const distanceToRoute = (x: number, y: number, points: ReadonlyArray<LayoutPoint>) => {
	let distance = Number.POSITIVE_INFINITY;
	for (let index = 1; index < points.length; index += 1)
		distance = Math.min(distance, distanceToSegment(x, y, points[index - 1]!, points[index]!));
	return distance;
};

/** Resolves the topmost selectable port, node, or routed edge at one world position. */
export const readHitFx = Effect.fn("readHitFx")(
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
		readonly backbones: ReadonlyMap<string, ReadonlyArray<LayoutPoint>>;
		readonly connectedPorts: ConnectedPorts;
		readonly flow: EditorItemOriginFlow;
		readonly highlight: Highlight | undefined;
		readonly metroBackbones: ReadonlyMap<string, ReadonlyArray<LayoutPoint>>;
		readonly nodeMetrics: ReadonlyMap<string, NodeMetrics>;
		readonly positions: ReadonlyMap<string, LayoutNode>;
		readonly selection: Selection | undefined;
		readonly x: number;
		readonly y: number;
		readonly zoom: number;
	}) =>
		Effect.sync((): Hit | undefined => {
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
				const readItemPortTarget = (portId: string) =>
					flow.edges
						.filter((edge) =>
							portId === EditorItemOriginItemInputPortId
								? edge.target === node.id && edge.targetPortId === portId
								: edge.source === node.id && edge.sourcePortId === portId,
						)
						.sort((left, right) => left.id.localeCompare(right.id))
						.map((edge) =>
							portId === EditorItemOriginItemInputPortId ? edge.source : edge.target,
						)
						.find((targetNodeId) => positions.has(targetNodeId));
				if (
					connectedPortIds?.has(EditorItemOriginItemInputPortId) === true &&
					Math.hypot(x - position.x, y - (position.y + metrics.itemPortY)) <=
						portTolerance
				) {
					const targetNodeId = readItemPortTarget(EditorItemOriginItemInputPortId);
					if (targetNodeId !== undefined)
						return {
							kind: "port",
							targetNodeId,
						};
				}
				if (
					connectedPortIds?.has(EditorItemOriginItemOutputPortId) === true &&
					Math.hypot(
						x - (position.x + position.width),
						y - (position.y + metrics.itemPortY),
					) <= portTolerance
				) {
					const targetNodeId = readItemPortTarget(EditorItemOriginItemOutputPortId);
					if (targetNodeId !== undefined)
						return {
							kind: "port",
							targetNodeId,
						};
				}
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
				const itemTextBounds = metrics.itemTextBounds;
				if (
					x >= position.x + itemTextBounds.x &&
					x <= position.x + itemTextBounds.x + itemTextBounds.width &&
					y >= position.y + itemTextBounds.y &&
					y <= position.y + itemTextBounds.y + itemTextBounds.height
				)
					return {
						itemId: node.itemId,
						kind: "item-detail",
					};
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
