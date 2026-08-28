import { Effect } from "effect";

import type { EditorItemOriginFlow } from "~/bridge/item/editor/EditorItemOriginFlow";
import type {
	EditorItemOriginFlowLayoutNode,
	EditorItemOriginFlowLayoutPoint,
} from "~/ui/item/editor/editorItemOriginFlowLayout";

export interface EditorOriginFlowViewport {
	x: number;
	y: number;
	zoom: number;
}

export interface EditorOriginFlowBounds {
	readonly maxX: number;
	readonly maxY: number;
	readonly minX: number;
	readonly minY: number;
}

const DefaultViewport: EditorOriginFlowViewport = {
	x: 24,
	y: 24,
	zoom: 0.75,
};
const MinZoom = 0.025;
const MaxZoom = 1.4;
const FitPaddingRatio = 0.12;

const clampZoom = (zoom: number) => Math.max(MinZoom, Math.min(MaxZoom, zoom));

const readFlowBounds = (positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>) => {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (const node of positions.values()) {
		minX = Math.min(minX, node.x);
		minY = Math.min(minY, node.y);
		maxX = Math.max(maxX, node.x + node.width);
		maxY = Math.max(maxY, node.y + node.height);
	}
	return [
		minX,
		minY,
		maxX,
		maxY,
	].every(Number.isFinite)
		? {
				maxX,
				maxY,
				minX,
				minY,
			}
		: {
				maxX: 1,
				maxY: 1,
				minX: 0,
				minY: 0,
			};
};

const readFit = (
	positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>,
	width: number,
	height: number,
): EditorOriginFlowViewport => {
	const bounds = readFlowBounds(positions);
	const contentWidth = Math.max(1, bounds.maxX - bounds.minX);
	const contentHeight = Math.max(1, bounds.maxY - bounds.minY);
	const availableWidth = Math.max(1, width * (1 - FitPaddingRatio * 2));
	const availableHeight = Math.max(1, height * (1 - FitPaddingRatio * 2));
	const zoom = clampZoom(
		Math.min(availableWidth / contentWidth, availableHeight / contentHeight),
	);
	return {
		x: (width - contentWidth * zoom) / 2 - bounds.minX * zoom,
		y: (height - contentHeight * zoom) / 2 - bounds.minY * zoom,
		zoom,
	};
};

const readNode = (
	position: EditorItemOriginFlowLayoutNode,
	width: number,
	height: number,
	zoom: number,
): EditorOriginFlowViewport => ({
	x: width / 2 - (position.x + position.width / 2) * zoom,
	y: height / 2 - (position.y + position.height / 2) * zoom,
	zoom,
});

const readInitialFocus = (
	flow: EditorItemOriginFlow,
	positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>,
) => {
	const starters = flow.nodes
		.filter((node) => node.starterScopes.length > 0)
		.map((node) => ({
			id: node.id,
			position: positions.get(node.id),
		}))
		.filter(
			(
				candidate,
			): candidate is {
				readonly id: string;
				readonly position: EditorItemOriginFlowLayoutNode;
			} => candidate.position !== undefined,
		)
		.sort(
			(left, right) =>
				left.position.flowOrder - right.position.flowOrder ||
				left.id.localeCompare(right.id),
		);
	return (
		starters[0]?.position ??
		[
			...positions.entries(),
		].sort(
			([leftId, left], [rightId, right]) =>
				left.flowOrder - right.flowOrder || leftId.localeCompare(rightId),
		)[0]?.[1]
	);
};

const readVisibleBounds = (
	viewport: EditorOriginFlowViewport,
	width: number,
	height: number,
	paddingPx = 0,
): EditorOriginFlowBounds => {
	const padding = paddingPx / viewport.zoom;
	return {
		maxX: (width - viewport.x) / viewport.zoom + padding,
		maxY: (height - viewport.y) / viewport.zoom + padding,
		minX: -viewport.x / viewport.zoom - padding,
		minY: -viewport.y / viewport.zoom - padding,
	};
};

const readBackboneBounds = (
	backbones: ReadonlyMap<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>,
) =>
	new Map(
		[
			...backbones,
		].map(([id, backbone]) => {
			const xs = backbone.map(({ x }) => x);
			const ys = backbone.map(({ y }) => y);
			return [
				id,
				{
					maxX: Math.max(...xs),
					maxY: Math.max(...ys),
					minX: Math.min(...xs),
					minY: Math.min(...ys),
				} satisfies EditorOriginFlowBounds,
			] as const;
		}),
	);

/** Creates the pure viewport and culling capability used by one flow canvas module. */
export const createEditorOriginFlowViewportFx = Effect.fn("createEditorOriginFlowViewportFx")(() =>
	Effect.succeed({
		clampZoom,
		defaultViewport: DefaultViewport,
		edgeCullPaddingPx: 64,
		isEdgeVisible: (bounds: EditorOriginFlowBounds, visible: EditorOriginFlowBounds) =>
			bounds.maxX >= visible.minX &&
			bounds.maxY >= visible.minY &&
			bounds.minX <= visible.maxX &&
			bounds.minY <= visible.maxY,
		isNodeVisible: (
			position: EditorItemOriginFlowLayoutNode,
			visible: EditorOriginFlowBounds,
		) =>
			position.x + position.width >= visible.minX &&
			position.y + position.height >= visible.minY &&
			position.x <= visible.maxX &&
			position.y <= visible.maxY,
		readBackboneBounds,
		readFit,
		readInitialFocus,
		readNode,
		readVisibleBounds,
		searchFocusZoom: 1,
	} as const),
);
