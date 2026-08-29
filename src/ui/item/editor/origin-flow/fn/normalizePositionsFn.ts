import type { LayoutNode } from "~/ui/item/editor/origin-flow/Layout";
import type { PlacedNode } from "~/ui/item/editor/origin-flow/PlacedNode";
import type { LayoutProfile } from "~/ui/item/editor/origin-flow/Topology";

interface MutableNodePosition extends PlacedNode {
	x: number;
	y: number;
}

const LayoutMargin = 96;
const OverlapGap = 32;
const OverlapIterations = 1800;
const OverlapTolerance = 0.2;

const deterministicUnit = (leftId: string, rightId: string) => {
	let hash = 2166136261;
	for (const char of `${leftId}\u0000${rightId}`) {
		hash ^= char.charCodeAt(0);
		hash = Math.imul(hash, 16777619);
	}
	const angle = ((hash >>> 0) / 4294967296) * Math.PI * 2;
	return {
		x: Math.cos(angle),
		y: Math.sin(angle),
	};
};

const relaxOverlaps = (nodes: MutableNodePosition[]) => {
	for (let iteration = 0; iteration < OverlapIterations; iteration += 1) {
		let maximumOverlap = 0;
		for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
			const left = nodes[leftIndex]!;
			for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
				const right = nodes[rightIndex]!;
				const leftX = left.x - left.haloX;
				const leftY = left.y - left.haloY;
				const leftWidth = left.width + left.haloX * 2;
				const leftHeight = left.height + left.haloY * 2;
				const rightX = right.x - right.haloX;
				const rightY = right.y - right.haloY;
				const rightWidth = right.width + right.haloX * 2;
				const rightHeight = right.height + right.haloY * 2;
				const overlapX =
					Math.min(leftX + leftWidth, rightX + rightWidth) - Math.max(leftX, rightX);
				const overlapY =
					Math.min(leftY + leftHeight, rightY + rightHeight) - Math.max(leftY, rightY);
				if (overlapX <= 0 || overlapY <= 0) continue;
				maximumOverlap = Math.max(maximumOverlap, Math.min(overlapX, overlapY));
				const leftInverseMass = 1 / (1 + 18 * left.importance ** 2);
				const rightInverseMass = 1 / (1 + 18 * right.importance ** 2);
				const inverseMass = leftInverseMass + rightInverseMass;
				if (overlapX < overlapY) {
					let direction = Math.sign(
						right.x + right.width / 2 - (left.x + left.width / 2),
					);
					if (direction === 0)
						direction = deterministicUnit(left.id, right.id).x >= 0 ? 1 : -1;
					const movement = overlapX + OverlapGap;
					left.x -= direction * movement * (leftInverseMass / inverseMass);
					right.x += direction * movement * (rightInverseMass / inverseMass);
				} else {
					let direction = Math.sign(
						right.y + right.height / 2 - (left.y + left.height / 2),
					);
					if (direction === 0)
						direction = deterministicUnit(left.id, right.id).y >= 0 ? 1 : -1;
					const movement = overlapY + OverlapGap;
					left.y -= direction * movement * (leftInverseMass / inverseMass);
					right.y += direction * movement * (rightInverseMass / inverseMass);
				}
			}
		}
		if (maximumOverlap < OverlapTolerance) break;
	}
};

/** Removes placement overlap and normalizes final flow positions into positive canvas space. */
export const normalizePositionsFn = (
	placed: ReadonlyArray<PlacedNode>,
	profiles: ReadonlyMap<string, LayoutProfile>,
	flowOrder: ReadonlyMap<string, number>,
) => {
	const relaxed = placed.map((node) => ({
		...node,
	}));
	if (relaxed.length === 0) return new Map<string, LayoutNode>();
	relaxOverlaps(relaxed);

	let minimumX = Number.POSITIVE_INFINITY;
	let minimumY = Number.POSITIVE_INFINITY;
	for (const node of relaxed) {
		minimumX = Math.min(minimumX, node.x);
		minimumY = Math.min(minimumY, node.y);
	}
	const shiftX = LayoutMargin - minimumX;
	const shiftY = LayoutMargin - minimumY;
	const positions = new Map<string, LayoutNode>();
	for (const node of relaxed) {
		const profile = profiles.get(node.id);
		const order = flowOrder.get(node.id);
		if (profile === undefined || order === undefined)
			throw new Error(`Missing final flow layout data for ${node.id}.`);
		positions.set(node.id, {
			flowOrder: order,
			height: node.height,
			width: node.width,
			x: node.x + shiftX,
			y: node.y + shiftY,
		});
	}
	return positions;
};
