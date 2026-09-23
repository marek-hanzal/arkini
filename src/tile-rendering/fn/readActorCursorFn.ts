export namespace readActorCursorFn {
	export interface Props {
		readonly hasDropTarget?: boolean;
		readonly phase: "dragging" | "idle" | "pending";
		readonly running: boolean;
	}
}

/** Resolves native Pixi cursor feedback from gesture ownership and target presence. */
export const readActorCursorFn = ({ hasDropTarget, phase, running }: readActorCursorFn.Props) => {
	if (phase === "dragging") return hasDropTarget === false ? "not-allowed" : "grabbing";
	return running ? "progress" : "grab";
};
