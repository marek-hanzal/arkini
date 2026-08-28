import { Order } from "effect";

import type { EditorItemOriginEdge } from "~/bridge/item/editor/EditorItemOriginFlow";

/** Input follows downstream consumers; Output follows upstream producers. */
export type OriginFlowDirection = "input" | "output";

export const EdgeOrder = Order.make<EditorItemOriginEdge>((left, right) => {
	const operationOrder = left.operationId.localeCompare(right.operationId);
	if (operationOrder !== 0) return operationOrder < 0 ? -1 : 1;
	const edgeOrder = left.id.localeCompare(right.id);
	return edgeOrder === 0 ? 0 : edgeOrder < 0 ? -1 : 1;
});

export type Selection =
	| {
			readonly id: string;
			readonly kind: "edge";
	  }
	| {
			readonly id: string;
			readonly kind: "node";
	  };

export interface Highlight {
	readonly edgeIds: ReadonlySet<string>;
	readonly edgeLevels: ReadonlyMap<string, number>;
	readonly nodeIds: ReadonlySet<string>;
	readonly nodeLevels: ReadonlyMap<string, number>;
}
