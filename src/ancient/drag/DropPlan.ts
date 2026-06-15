import type { RectLike } from "~/play/types";

export interface DropCommitContext {
	dragRect: RectLike | null;
	dragActorKey?: string;
}

export type DropPlan<
	ItemId extends string = string,
	_Kind extends string = string,
	_Overlay = unknown,
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
			/** Source ids hidden while commit/event animations are being resolved. */
			hide?: string[];
			commit(context: DropCommitContext): Promise<unknown> | unknown;
			feedback?(): void | Promise<void>;
	  };
