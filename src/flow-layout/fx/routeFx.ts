import { Effect, Order } from "effect";

import type { LayoutInput, LayoutNode, LayoutPoint } from "~/flow-layout/type/Layout";

const RouteEscape = 56;
const RouteDetourGap = 84;
const RouteBundleGrid = 96;

interface OrthogonalRoutePlan {
	readonly edgeId: string;
	readonly routeY: number;
	readonly source: LayoutPoint;
	readonly sourceTrackX: number;
	readonly target: LayoutPoint;
	readonly targetTrackX: number;
}

const readPortPointFn = (
	node: LayoutInput["nodes"][number],
	position: LayoutNode,
	portId: string | undefined,
	side: "source" | "target",
): LayoutPoint => {
	const port = portId === undefined ? undefined : node.ports.find(({ id }) => id === portId);
	if (port !== undefined)
		return {
			x: position.x + position.width / 2 + port.x,
			y: position.y + position.height / 2 + port.y,
		};
	return {
		x: side === "source" ? position.x + position.width : position.x,
		y: position.y + position.height / 2,
	};
};

const appendRoutePointFn = (points: LayoutPoint[], point: LayoutPoint) => {
	const previous = points.at(-1);
	if (
		previous === undefined ||
		Math.abs(previous.x - point.x) > 0.01 ||
		Math.abs(previous.y - point.y) > 0.01
	)
		points.push(point);
};

const snapRouteTrackFn = (value: number) => Math.round(value / RouteBundleGrid) * RouteBundleGrid;

const snapSourceTrackFn = (x: number) =>
	Math.ceil((x + RouteEscape) / RouteBundleGrid) * RouteBundleGrid;

const snapTargetTrackFn = (x: number) =>
	Math.floor((x - RouteEscape) / RouteBundleGrid) * RouteBundleGrid;

const readForwardTracksFn = (source: LayoutPoint, target: LayoutPoint) => {
	const minimumX = source.x + RouteEscape;
	const maximumX = target.x - RouteEscape;
	let sourceTrackX = snapSourceTrackFn(source.x);
	let targetTrackX = snapTargetTrackFn(target.x);
	if (sourceTrackX <= targetTrackX)
		return {
			sourceTrackX,
			targetTrackX,
		};

	const midpointX = (minimumX + maximumX) / 2;
	const sharedTrackX = Math.max(minimumX, Math.min(maximumX, snapRouteTrackFn(midpointX)));
	sourceTrackX = sharedTrackX;
	targetTrackX = sharedTrackX;
	return {
		sourceTrackX,
		targetTrackX,
	};
};

const readOrthogonalRoutePlanFn = (
	source: LayoutPoint,
	target: LayoutPoint,
	sourcePosition: LayoutNode,
	targetPosition: LayoutNode,
	edgeId: string,
): OrthogonalRoutePlan => {
	const forward = source.x + RouteEscape <= target.x - RouteEscape;
	if (forward) {
		const tracks = readForwardTracksFn(source, target);
		return {
			edgeId,
			routeY: snapRouteTrackFn((source.y + target.y) / 2),
			source,
			...tracks,
			target,
		};
	}

	const sourceTrackX = snapSourceTrackFn(source.x);
	const targetTrackX = snapTargetTrackFn(target.x);
	const upperBoundary = Math.min(sourcePosition.y, targetPosition.y) - RouteDetourGap;
	const lowerBoundary =
		Math.max(
			sourcePosition.y + sourcePosition.height,
			targetPosition.y + targetPosition.height,
		) + RouteDetourGap;
	const upperY = Math.floor(upperBoundary / RouteBundleGrid) * RouteBundleGrid;
	const lowerY = Math.ceil(lowerBoundary / RouteBundleGrid) * RouteBundleGrid;
	const upperCost = Math.abs(source.y - upperY) + Math.abs(target.y - upperY);
	const lowerCost = Math.abs(source.y - lowerY) + Math.abs(target.y - lowerY);
	return {
		edgeId,
		routeY: upperCost <= lowerCost ? upperY : lowerY,
		source,
		sourceTrackX,
		target,
		targetTrackX,
	};
};

const readOrthogonalRouteFn = (plan: OrthogonalRoutePlan): ReadonlyArray<LayoutPoint> => {
	const points: LayoutPoint[] = [
		plan.source,
	];
	appendRoutePointFn(points, {
		x: plan.sourceTrackX,
		y: plan.source.y,
	});
	appendRoutePointFn(points, {
		x: plan.sourceTrackX,
		y: plan.routeY,
	});
	appendRoutePointFn(points, {
		x: plan.targetTrackX,
		y: plan.routeY,
	});
	appendRoutePointFn(points, {
		x: plan.targetTrackX,
		y: plan.target.y,
	});
	appendRoutePointFn(points, plan.target);
	return points;
};

/** Routes every edge onto the shared coarse orthogonal track lattice. */
export const routeFx = Effect.fn("routeFx")(
	(flow: LayoutInput, positions: ReadonlyMap<string, LayoutNode>) =>
		Effect.sync((): ReadonlyMap<string, ReadonlyArray<LayoutPoint>> => {
			const nodeById = new Map(
				flow.nodes.map(
					(node) =>
						[
							node.id,
							node,
						] as const,
				),
			);
			const routes = new Map<string, ReadonlyArray<LayoutPoint>>();
			for (const edge of [
				...flow.edges,
			].sort((left, right) => Order.String(left.id, right.id))) {
				const sourceNode = nodeById.get(edge.source);
				const targetNode = nodeById.get(edge.target);
				const sourcePosition = positions.get(edge.source);
				const targetPosition = positions.get(edge.target);
				if (
					sourceNode === undefined ||
					targetNode === undefined ||
					sourcePosition === undefined ||
					targetPosition === undefined
				)
					throw new Error(
						`Cannot route flow edge ${edge.id}: missing endpoint layout data.`,
					);

				const source = readPortPointFn(
					sourceNode,
					sourcePosition,
					edge.sourcePortId,
					"source",
				);
				const target = readPortPointFn(
					targetNode,
					targetPosition,
					edge.targetPortId,
					"target",
				);
				const plan = readOrthogonalRoutePlanFn(
					source,
					target,
					sourcePosition,
					targetPosition,
					edge.id,
				);
				routes.set(edge.id, readOrthogonalRouteFn(plan));
			}
			return routes;
		}),
);
