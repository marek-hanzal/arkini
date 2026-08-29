import type { Effect } from "effect";
import type * as Atom from "effect/unstable/reactivity/Atom";

import type { ItemDetailTabEnumSchema } from "~/engine/item-detail/schema/ItemDetailTabEnumSchema";

export type ItemDetailPendingAction =
	| "autofill"
	| "clear-queue"
	| "default"
	| "enqueue"
	| "withdraw";

export interface RunItemDetailPendingActionProps<Result = unknown, Failure = unknown> {
	readonly key: string;
	readonly action: ItemDetailPendingAction;
	readonly failureMessage: string;
	readonly run: Effect.Effect<Result, Failure>;
}

/** Narrow command-settlement capability shared by Item Detail command bindings. */
export interface ItemDetailPendingActionOwner {
	readonly readActionError: (key: string) => string | null;
	readonly readPendingAction: (key: string) => ItemDetailPendingAction | null;
	readonly runPendingAction: <Result, Failure>(
		props: RunItemDetailPendingActionProps<Result, Failure>,
	) => void;
}

export type ItemDetailTarget =
	| {
			readonly kind: "runtime";
			readonly itemId: string;
			readonly tab: ItemDetailTabEnumSchema.Type;
			readonly linesSearchQuery?: string;
			readonly origin: HTMLElement | null;
	  }
	| {
			readonly kind: "definition";
			readonly itemId: string;
			readonly tab: Extract<ItemDetailTabEnumSchema.Type, "info" | "sources">;
			readonly origin: HTMLElement | null;
	  };

export type ItemDetailState =
	| {
			readonly phase: "closed";
	  }
	| {
			readonly phase: "entering";
			readonly target: ItemDetailTarget;
			readonly generation: number;
	  }
	| {
			readonly phase: "open";
			readonly target: ItemDetailTarget;
			readonly generation: number;
	  }
	| {
			readonly phase: "exiting";
			readonly target: ItemDetailTarget;
			readonly generation: number;
			readonly restoreFocus: boolean;
	  };

export interface CloseItemDetailProps {
	readonly restoreFocus?: boolean;
}

export interface OpenItemDetailProps {
	readonly itemId: string;
	readonly tab?: ItemDetailTabEnumSchema.Type;
	readonly linesSearchQuery?: string;
	readonly origin?: HTMLElement | null;
}

export interface OpenItemDefinitionDetailProps {
	readonly itemId: string;
	readonly tab?: Extract<ItemDetailTabEnumSchema.Type, "info" | "sources">;
	readonly origin?: HTMLElement | null;
}

export interface SelectRetainedItemDetailTabProps {
	readonly itemId: string;
	readonly tab: ItemDetailTabEnumSchema.Type;
}

/** Canvas-local owner for one exact capability-tabbed Item Detail modal. */
export interface ItemDetailControl extends ItemDetailPendingActionOwner {
	readonly state: ItemDetailState;
	readonly openItemDetailFx: (props: OpenItemDetailProps) => Effect.Effect<boolean>;
	readonly openItemDefinitionDetailFx: (
		props: OpenItemDefinitionDetailProps,
	) => Effect.Effect<boolean>;
	/**
	 * Changes only the presentation tab of the exact retained runtime target.
	 * It never resolves or grants gameplay authority to a disappeared item.
	 */
	readonly selectRetainedItemDetailTabFx: (
		props: SelectRetainedItemDetailTabProps,
	) => Effect.Effect<boolean>;
	readonly closeAtom: Atom.AtomResultFn<CloseItemDetailProps | undefined, void, never>;
	readonly closeFx: (props?: CloseItemDetailProps) => Effect.Effect<void>;
	readonly completeEnterFx: (generation: number) => Effect.Effect<void>;
	readonly completeExitFx: (generation: number) => Effect.Effect<void>;
}
