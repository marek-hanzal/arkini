import type { DraggableAnimation } from "./DraggableAnimation";

export type DropPlan<
	ItemId extends string = string,
	Kind extends string = string,
	Overlay = unknown,
> =
	| {
			type: "ignore";
	  }
	| {
			type: "reject";
			feedback?(): void | Promise<void>;
			animateReturn?: boolean;
	  }
	| {
			type: "accept";
			/** Source ids hidden while commit/animations are being resolved. */
			hide?: string[];
			/** Generic pre/post move animations. */
			animations?: DraggableAnimation<ItemId, Kind, Overlay>[];
			animationTiming?: "beforeCommit" | "afterCommit";
			commit(): Promise<unknown> | unknown;
			feedback?(): void | Promise<void>;
	  };
