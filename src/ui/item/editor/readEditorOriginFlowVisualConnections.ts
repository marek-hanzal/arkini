import type { EditorItemOriginEdge } from "~/bridge/item/editor/readEditorItemOriginFlow";

export interface EditorOriginFlowVisualConnection {
	readonly edgeIds: ReadonlyArray<string>;
	readonly id: string;
	readonly source: string;
	readonly target: string;
}

/** Collapses duplicate logical edges between the same directed item pair for map rendering. */
export const readEditorOriginFlowVisualConnections = (
	edges: ReadonlyArray<EditorItemOriginEdge>,
): ReadonlyArray<EditorOriginFlowVisualConnection> => {
	const byPair = new Map<
		string,
		{
			source: string;
			target: string;
			edgeIds: string[];
		}
	>();
	for (const edge of [
		...edges,
	].sort((left, right) => left.id.localeCompare(right.id))) {
		const key = `${edge.source}\u0000${edge.target}`;
		const connection = byPair.get(key) ?? {
			edgeIds: [],
			source: edge.source,
			target: edge.target,
		};
		connection.edgeIds.push(edge.id);
		byPair.set(key, connection);
	}
	return [
		...byPair.values(),
	]
		.sort(
			(left, right) =>
				left.source.localeCompare(right.source) || left.target.localeCompare(right.target),
		)
		.map(({ edgeIds, source, target }) => ({
			edgeIds,
			id: `connection:${source}->${target}`,
			source,
			target,
		}));
};
