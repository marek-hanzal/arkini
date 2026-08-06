export interface EditorItemOriginFlowLayoutInput {
	readonly edges: ReadonlyArray<{
		readonly role: "input" | "output" | "owner";
		readonly source: string;
		readonly target: string;
	}>;
	readonly nodes: ReadonlyArray<{
		readonly id: string;
		readonly kind: "item" | "source";
		readonly starter: boolean;
	}>;
}

export interface EditorItemOriginFlowLayoutNode {
	readonly height: number;
	readonly width: number;
	readonly x: number;
	readonly y: number;
}

const Margin = 32;
const NodeSeparation = 128;
const RankSeparation = 320;
const OrderingSweeps = 4;

const readNodeSize = (kind: "item" | "source") =>
	kind === "item"
		? {
				height: 76,
				width: 224,
			}
		: {
				height: 112,
				width: 256,
			};

const addAdjacentNode = (adjacency: Map<string, string[]>, source: string, target: string) => {
	const adjacent = adjacency.get(source);
	if (adjacent === undefined)
		adjacency.set(source, [
			target,
		]);
	else adjacent.push(target);
};

const readRanks = (
	flow: EditorItemOriginFlowLayoutInput,
	outgoing: ReadonlyMap<string, ReadonlyArray<string>>,
	incoming: ReadonlyMap<string, ReadonlyArray<string>>,
) => {
	const nodeIds = [
		...new Set(flow.nodes.map(({ id }) => id)),
	].sort();
	const ranks = new Map<string, number>();
	const pending: string[] = [];
	const expand = () => {
		for (let index = 0; index < pending.length; index += 1) {
			const source = pending[index];
			if (source === undefined) continue;
			const nextRank = (ranks.get(source) ?? 0) + 1;
			for (const target of outgoing.get(source) ?? []) {
				if (ranks.has(target)) continue;
				ranks.set(target, nextRank);
				pending.push(target);
			}
		}
		pending.length = 0;
	};
	const seed = (nodeIds: ReadonlyArray<string>) => {
		for (const nodeId of nodeIds) {
			if (ranks.has(nodeId)) continue;
			ranks.set(nodeId, 0);
			pending.push(nodeId);
		}
		expand();
	};

	seed(
		flow.nodes
			.filter(({ starter }) => starter)
			.map(({ id }) => id)
			.sort(),
	);
	while (ranks.size < nodeIds.length) {
		const remaining = nodeIds.filter((id) => !ranks.has(id));
		const roots = remaining.filter((id) =>
			(incoming.get(id) ?? []).every((source) => ranks.has(source)),
		);
		seed(
			roots.length > 0
				? roots
				: [
						remaining[0] as string,
					],
		);
	}
	return ranks;
};

const orderRanks = (
	groups: Map<number, string[]>,
	ranks: ReadonlyMap<string, number>,
	outgoing: ReadonlyMap<string, ReadonlyArray<string>>,
	incoming: ReadonlyMap<string, ReadonlyArray<string>>,
) => {
	const rankIds = [
		...groups.keys(),
	].sort((left, right) => left - right);
	for (let sweep = 0; sweep < OrderingSweeps; sweep += 1) {
		const forward = sweep % 2 === 0;
		const orderedRankIds = forward
			? rankIds
			: [
					...rankIds,
				].reverse();
		const positions = new Map<string, number>();
		for (const nodeIds of groups.values()) {
			for (const [index, nodeId] of nodeIds.entries()) positions.set(nodeId, index);
		}
		for (const rank of orderedRankIds) {
			const nodeIds = groups.get(rank);
			if (nodeIds === undefined) continue;
			const barycenter = (nodeId: string) => {
				const adjacent = (forward ? incoming : outgoing).get(nodeId) ?? [];
				const relevant = adjacent.filter((candidate) =>
					forward
						? (ranks.get(candidate) ?? rank) < rank
						: (ranks.get(candidate) ?? rank) > rank,
				);
				if (relevant.length === 0) return positions.get(nodeId) ?? 0;
				return (
					relevant.reduce(
						(total, candidate) => total + (positions.get(candidate) ?? 0),
						0,
					) / relevant.length
				);
			};
			nodeIds.sort((left, right) => {
				const distance = barycenter(left) - barycenter(right);
				if (distance !== 0) return distance;
				return left < right ? -1 : left > right ? 1 : 0;
			});
			for (const [index, nodeId] of nodeIds.entries()) positions.set(nodeId, index);
		}
	}
};

/** Lays out the item/source graph in deterministic progression ranks without routing edges. */
export const layoutEditorItemOriginFlow = (
	flow: EditorItemOriginFlowLayoutInput,
): ReadonlyMap<string, EditorItemOriginFlowLayoutNode> => {
	const nodeKinds = new Map(
		flow.nodes.map(({ id, kind }) => [
			id,
			kind,
		]),
	);
	const outgoing = new Map<string, string[]>();
	const incoming = new Map<string, string[]>();
	const progressionOutgoing = new Map<string, string[]>();
	const progressionIncoming = new Map<string, string[]>();
	for (const { role, source, target } of flow.edges) {
		if (!nodeKinds.has(source) || !nodeKinds.has(target)) continue;
		addAdjacentNode(outgoing, source, target);
		addAdjacentNode(incoming, target, source);
		if (role !== "input") {
			addAdjacentNode(progressionOutgoing, source, target);
			addAdjacentNode(progressionIncoming, target, source);
		}
	}
	const ranks = readRanks(flow, progressionOutgoing, progressionIncoming);
	const groups = new Map<number, string[]>();
	for (const { id } of flow.nodes) {
		const rank = ranks.get(id) ?? 0;
		const group = groups.get(rank);
		if (group === undefined)
			groups.set(rank, [
				id,
			]);
		else group.push(id);
	}
	for (const group of groups.values()) group.sort();
	orderRanks(groups, ranks, outgoing, incoming);

	const rankIds = [
		...groups.keys(),
	].sort((left, right) => left - right);
	const positions = new Map<string, EditorItemOriginFlowLayoutNode>();
	let x = Margin;
	for (const rank of rankIds) {
		const nodeIds = groups.get(rank) ?? [];
		const rankWidth = Math.max(
			0,
			...nodeIds.map((id) => readNodeSize(nodeKinds.get(id) ?? "item").width),
		);
		let y = Margin;
		for (const id of nodeIds) {
			const size = readNodeSize(nodeKinds.get(id) ?? "item");
			positions.set(id, {
				...size,
				x,
				y,
			});
			y += size.height + NodeSeparation;
		}
		x += rankWidth + RankSeparation;
	}
	return positions;
};
