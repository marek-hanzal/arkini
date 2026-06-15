export interface DroppablePayload<Target = unknown> {
	/** Stable key of the drop target. */
	targetId: string;
	/** Node measured by generic animations. */
	targetNodeId: string;
	/** App-owned target data. The control never inspects it. */
	target: Target;
}
