import type { Effect } from "effect";

import type { ItemDetailTab } from "~/bridge/item-detail/ItemDetailTab";

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

export type ItemDetailPendingAction = "autofill" | "clear-queue" | "default" | "start" | "withdraw";

export interface RunItemDetailPendingActionProps {
	readonly key: string;
	readonly action: ItemDetailPendingAction;
	readonly failureMessage: string;
	readonly run: () => Promise<unknown>;
}

/** Canvas-local owner for one exact capability-tabbed Item Detail modal. */
export interface ItemDetailControl {
	readonly state: ItemDetailState;
	readonly isOpen: boolean;
	readonly hasPendingActions: boolean;
	readonly readActionError: (key: string) => string | null;
	readonly readPendingAction: (key: string) => ItemDetailPendingAction | null;
	readonly runPendingActionFx: (props: RunItemDetailPendingActionProps) => Effect.Effect<unknown>;
	readonly openItemDetailFx: (props: OpenItemDetailProps) => Effect.Effect<boolean>;
	readonly openItemDefinitionDetailFx: (
		props: OpenItemDefinitionDetailProps,
	) => Effect.Effect<boolean>;
	readonly closeFx: (props?: CloseItemDetailProps) => Effect.Effect<void>;
	readonly completeEnterFx: (generation: number) => Effect.Effect<void>;
	readonly completeExitFx: (generation: number) => Effect.Effect<void>;
}
