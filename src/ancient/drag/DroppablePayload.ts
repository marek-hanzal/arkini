export interface DroppablePayload<Target = unknown> {
	/** Stable key of the drop target. */
	targetId: string;
	/** DOM node used for hit-testing and target feedback. */
	targetNodeId: string;
	/** App-owned target data. The control never inspects it. */
	target: Target;
}
