import { Effect } from "effect";

import type {
	EditorItemOriginFlowLayoutProfile,
	EditorItemOriginFlowPair,
} from "~/ui/item/editor/EditorItemOriginFlowTopology";
import type { EditorItemOriginFlowLayoutInput } from "~/ui/item/editor/editorItemOriginFlowLayout";

/** Derives node spacing pressure from topology degree and connected operation ports. */
export const readEditorItemOriginFlowProfilesFx = Effect.fn("readEditorItemOriginFlowProfilesFx")(
	(flow: EditorItemOriginFlowLayoutInput, pairs: ReadonlyArray<EditorItemOriginFlowPair>) =>
		Effect.sync((): ReadonlyMap<string, EditorItemOriginFlowLayoutProfile> => {
			const neighbors = new Map(
				flow.nodes.map(
					({ id }) =>
						[
							id,
							new Set<string>(),
						] as const,
				),
			);
			const connectedPorts = new Map(
				flow.nodes.map(
					({ id }) =>
						[
							id,
							new Set<string>(),
						] as const,
				),
			);
			for (const { a, b } of pairs) {
				neighbors.get(a)?.add(b);
				neighbors.get(b)?.add(a);
			}
			for (const edge of flow.edges) {
				connectedPorts.get(edge.source)?.add(`source:${edge.sourcePortId ?? "item"}`);
				connectedPorts.get(edge.target)?.add(`target:${edge.targetPortId ?? "item"}`);
			}
			const maximumDegree = Math.max(
				1,
				...[
					...neighbors.values(),
				].map((value) => value.size),
			);
			const maximumPortCount = Math.max(
				1,
				...[
					...connectedPorts.values(),
				].map((value) => value.size),
			);
			return new Map(
				flow.nodes.map((node) => {
					const degree = neighbors.get(node.id)?.size ?? 0;
					const portCount = connectedPorts.get(node.id)?.size ?? 0;
					const degreePressure = Math.sqrt(degree / maximumDegree);
					const portPressure = Math.sqrt(portCount / maximumPortCount);
					const importance = Math.min(1, 0.75 * degreePressure + 0.25 * portPressure);
					return [
						node.id,
						{
							haloX: 30 + 150 * importance ** 1.2 + 28 * Math.log2(1 + degree),
							haloY: 24 + 90 * importance ** 1.2 + 12 * Math.log2(1 + portCount),
							importance,
						},
					] as const;
				}),
			);
		}),
);
