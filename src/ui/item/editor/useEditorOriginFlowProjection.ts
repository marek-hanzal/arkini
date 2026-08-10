import { useEffect, useMemo, useState } from "react";

import type { EditorItemOriginFlow } from "~/bridge/item/editor/readEditorItemOriginFlowFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type {
	EditorItemOriginFlowLayoutNode,
	EditorItemOriginFlowLayoutPoint,
} from "~/ui/item/editor/editorItemOriginFlowLayout";
import {
	type EditorOriginFlowDirection,
	type EditorOriginFlowHighlight,
	type EditorOriginFlowSelection,
	readEditorOriginFlowHighlightFx,
} from "~/ui/item/editor/readEditorOriginFlowHighlightFx";
import { readEditorOriginFlowMetroBackbonesFx } from "~/ui/item/editor/readEditorOriginFlowMetroBackbonesFx";
import { readEditorOriginFlowNavigationFx } from "~/ui/item/editor/readEditorOriginFlowNavigationFx";
import { readEditorOriginFlowRelationNavigationFx } from "~/ui/item/editor/readEditorOriginFlowRelationNavigationFx";
import { readEditorOriginFlowRootNavigationFx } from "~/ui/item/editor/readEditorOriginFlowRootNavigationFx";
import { readEditorOriginFlowVisibleHighlightFx } from "~/ui/item/editor/readEditorOriginFlowVisibleHighlightFx";

export const EditorOriginFlowDefaultHighlightDepth = 1;

export interface EditorOriginFlowHighlightDepth {
	readonly direction: EditorOriginFlowDirection;
	readonly limit: number;
	readonly nodeId: string;
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

const hashText = (value: string) => {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
};

const readHighlightedEdgeColors = (
	flow: EditorItemOriginFlow,
	selection: EditorOriginFlowSelection | undefined,
	highlight: EditorOriginFlowHighlight | undefined,
) => {
	if (selection === undefined) return new Map<string, string>();
	const highlightedIds = new Set(highlight?.edgeIds ?? []);
	if (selection.kind === "edge") highlightedIds.add(selection.id);
	const edgeIds = flow.edges
		.map(({ id }) => id)
		.filter((id) => highlightedIds.has(id))
		.sort((left, right) => left.localeCompare(right));
	const offset = hashText(selection.id) % HighlightRouteColors.length;
	return new Map(
		edgeIds.map(
			(edgeId, index) =>
				[
					edgeId,
					HighlightRouteColors[(offset + index) % HighlightRouteColors.length]!,
				] as const,
		),
	);
};

const readHighlightedPortColors = (
	flow: EditorItemOriginFlow,
	edgeColors: ReadonlyMap<string, string>,
) => {
	const byNodeId = new Map<string, Map<string, string>>();
	const write = (nodeId: string, portId: string | undefined, color: string) => {
		if (portId === undefined) return;
		const colors = byNodeId.get(nodeId) ?? new Map<string, string>();
		if (!colors.has(portId)) colors.set(portId, color);
		byNodeId.set(nodeId, colors);
	};
	for (const edge of flow.edges) {
		const color = edgeColors.get(edge.id);
		if (color === undefined) continue;
		write(edge.source, edge.sourcePortId, color);
		write(edge.target, edge.targetPortId, color);
	}
	return byNodeId as ReadonlyMap<string, ReadonlyMap<string, string>>;
};

/** Owns the complete direction-aware selection and navigation projection for one flow canvas. */
export const useEditorOriginFlowProjection = ({
	backbones,
	direction,
	flow,
	positions,
	selection,
}: {
	readonly backbones: ReadonlyMap<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>;
	readonly direction: EditorOriginFlowDirection;
	readonly flow: EditorItemOriginFlow;
	readonly positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>;
	readonly selection: EditorOriginFlowSelection | undefined;
}) => {
	const [highlightDepth, setHighlightDepth] = useState<EditorOriginFlowHighlightDepth>();
	const completeHighlight = useMemo(
		() =>
			selection === undefined
				? undefined
				: RendererRuntime.runSync(
						readEditorOriginFlowHighlightFx(flow, selection, direction),
					),
		[
			direction,
			flow,
			selection,
		],
	);
	const maxHighlightLevel = useMemo(
		() =>
			completeHighlight === undefined
				? 0
				: Math.max(0, ...completeHighlight.nodeLevels.values()),
		[
			completeHighlight,
		],
	);
	const highlightDepthLimit =
		selection?.kind === "node"
			? Math.min(
					highlightDepth?.nodeId === selection.id &&
						highlightDepth.direction === direction
						? highlightDepth.limit
						: EditorOriginFlowDefaultHighlightDepth,
					maxHighlightLevel,
				)
			: undefined;
	const highlight = useMemo(
		() =>
			selection?.kind !== "node" ||
			completeHighlight === undefined ||
			highlightDepthLimit === undefined ||
			highlightDepthLimit >= maxHighlightLevel
				? completeHighlight
				: RendererRuntime.runSync(
						readEditorOriginFlowVisibleHighlightFx(
							completeHighlight,
							highlightDepthLimit,
						),
					),
		[
			completeHighlight,
			highlightDepthLimit,
			maxHighlightLevel,
			selection,
		],
	);
	const highlightedEdgeColors = useMemo(
		() => readHighlightedEdgeColors(flow, selection, highlight),
		[
			flow,
			highlight,
			selection,
		],
	);
	const metroBackbones = useMemo(
		() =>
			RendererRuntime.runSync(
				readEditorOriginFlowMetroBackbonesFx(backbones, [
					...highlightedEdgeColors.keys(),
				]),
			),
		[
			backbones,
			highlightedEdgeColors,
		],
	);
	const highlightedPortColors = useMemo(
		() => readHighlightedPortColors(flow, highlightedEdgeColors),
		[
			flow,
			highlightedEdgeColors,
		],
	);
	const navigationNodeIds = useMemo(
		() =>
			selection?.kind === "node"
				? RendererRuntime.runSync(
						readEditorOriginFlowNavigationFx(
							flow,
							positions,
							selection.id,
							direction,
							highlight?.edgeIds,
						),
					)
				: [],
		[
			direction,
			flow,
			highlight,
			positions,
			selection,
		],
	);
	const inputNavigationNodeIds = useMemo(
		() =>
			selection?.kind === "node"
				? RendererRuntime.runSync(
						readEditorOriginFlowRelationNavigationFx({
							flow,
							selectedNodeId: selection.id,
							selectedRole: "input",
						}),
					)
				: [],
		[
			flow,
			selection,
		],
	);
	const outputNavigationNodeIds = useMemo(
		() =>
			selection?.kind === "node"
				? RendererRuntime.runSync(
						readEditorOriginFlowRelationNavigationFx({
							flow,
							selectedNodeId: selection.id,
							selectedRole: "output",
						}),
					)
				: [],
		[
			flow,
			selection,
		],
	);
	const rootNavigationNodeIds = useMemo(
		() =>
			selection?.kind === "node" && completeHighlight !== undefined
				? RendererRuntime.runSync(
						readEditorOriginFlowRootNavigationFx(flow, completeHighlight),
					)
				: [],
		[
			completeHighlight,
			flow,
			selection,
		],
	);

	useEffect(
		() => setHighlightDepth(undefined),
		[
			direction,
			selection,
		],
	);

	return {
		highlight,
		highlightedEdgeColors,
		highlightedPortColors,
		inputNavigationNodeIds,
		maxHighlightLevel,
		metroBackbones,
		navigationNodeIds,
		outputNavigationNodeIds,
		rootNavigationNodeIds,
		setHighlightDepth,
	};
};
