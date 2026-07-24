import type { Effect } from "effect";
import type * as Atom from "effect/unstable/reactivity/Atom";

import type { ItemDetailTab } from "~/bridge/item-detail/ItemDetailTab";
import type {
	ItemDetailPendingAction,
	RunItemDetailPendingActionProps,
} from "~/bridge/item-detail/ItemDetailPendingActionOwner";

export type {
	ItemDetailPendingAction,
	RunItemDetailPendingActionProps,
} from "~/bridge/item-detail/ItemDetailPendingActionOwner";

export type ItemDetailTarget =
	| {
			readonly kind: "runtime";
			readonly itemId: string;
			readonly tab: ItemDetailTab;
			readonly origin: HTMLElement | null;
	  }
	| {
			readonly kind: "definition";
			readonly itemId: string;
			readonly tab: Extract<ItemDetailTab, "info" | "sources">;
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
	readonly tab?: ItemDetailTab;
	readonly origin?: HTMLElement | null;
}

export interface OpenItemDefinitionDetailProps {
	readonly itemId: string;
	readonly tab?: Extract<ItemDetailTab, "info" | "sources">;
	readonly origin?: HTMLElement | null;
}

/** Canvas-local owner for one exact capability-tabbed Item Detail modal. */
export interface ItemDetailControl {
	readonly state: ItemDetailState;
	readonly isOpen: boolean;
	readonly hasPendingActions: boolean;
	readonly readActionError: (key: string) => string | null;
	readonly readPendingAction: (key: string) => ItemDetailPendingAction | null;
	readonly runPendingActionFx: <Result, Failure>(
		props: RunItemDetailPendingActionProps<Result, Failure>,
	) => Effect.Effect<Result | void, Failure>;
	readonly openItemDetailFx: (props: OpenItemDetailProps) => Effect.Effect<boolean>;
	readonly openItemDefinitionDetailFx: (
		props: OpenItemDefinitionDetailProps,
	) => Effect.Effect<boolean>;
	readonly closeAtom: Atom.AtomResultFn<CloseItemDetailProps | undefined, void, never>;
	readonly closeFx: (props?: CloseItemDetailProps) => Effect.Effect<void>;
	readonly completeEnterFx: (generation: number) => Effect.Effect<void>;
	readonly completeExitFx: (generation: number) => Effect.Effect<void>;
}
