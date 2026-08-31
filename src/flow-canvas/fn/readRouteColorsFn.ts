import { Order } from "effect";

import type { ItemOriginFlow } from "~/flow/type/ItemOriginFlow";
import type { Highlight, Selection } from "~/flow-canvas/type/Highlight";

interface RouteColors {
	readonly edges: ReadonlyMap<string, string>;
	readonly ports: ReadonlyMap<string, ReadonlyMap<string, string>>;
}

const HighlightRouteColors = Array.from(
	{
		length: 64,
	},
	(_, index) => {
		const hue = (index * 137.50776405003785) % 360;
		const saturation = [
			88,
			76,
			94,
			70,
		][index % 4]!;
		const lightness = [
			38,
			48,
			32,
			56,
		][index % 4]!;
		return `hsl(${hue.toFixed(1)}, ${saturation}%, ${lightness}%)`;
	},
);

const hashTextFn = (value: string) => {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
};

/** Projects stable colors onto selected flow routes and their connected ports. */
export const readRouteColorsFn = (
	flow: ItemOriginFlow,
	selection: Selection | undefined,
	highlight: Highlight | undefined,
): RouteColors => {
	if (selection === undefined)
		return {
			edges: new Map<string, string>(),
			ports: new Map<string, ReadonlyMap<string, string>>(),
		};
	const highlightedIds = new Set(highlight?.edgeIds ?? []);
	if (selection.kind === "edge") highlightedIds.add(selection.id);
	const edgeIds = flow.edges
		.map(({ id }) => id)
		.filter((id) => highlightedIds.has(id))
		.sort((left, right) => Order.String(left, right));
	const offset = hashTextFn(selection.id) % HighlightRouteColors.length;
	const edges = new Map(
		edgeIds.map(
			(edgeId, index) =>
				[
					edgeId,
					HighlightRouteColors[(offset + index) % HighlightRouteColors.length]!,
				] as const,
		),
	);
	const ports = new Map<string, Map<string, string>>();
	const writePortFn = (nodeId: string, portId: string | undefined, color: string) => {
		if (portId === undefined) return;
		const colors = ports.get(nodeId) ?? new Map<string, string>();
		if (!colors.has(portId)) colors.set(portId, color);
		ports.set(nodeId, colors);
	};
	for (const edge of flow.edges) {
		const color = edges.get(edge.id);
		if (color === undefined) continue;
		writePortFn(edge.source, edge.sourcePortId, color);
		writePortFn(edge.target, edge.targetPortId, color);
	}
	return {
		edges,
		ports,
	};
};
