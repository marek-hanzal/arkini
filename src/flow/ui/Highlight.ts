import { Order } from "effect";

import type { EditorItemOriginEdge } from "~/flow/domain/EditorItemOriginFlow";

/** Input follows downstream consumers; Output follows upstream producers. */
export type OriginFlowDirection = "input" | "output";

export const EdgeOrder = Order.make<EditorItemOriginEdge>((left, right) => {
	return Order.String(left.operationId, right.operationId) || Order.String(left.id, right.id);
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
