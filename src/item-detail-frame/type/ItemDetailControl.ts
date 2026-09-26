import type { Effect } from "effect";
import type * as Atom from "effect/unstable/reactivity/Atom";

export type ItemDetailTarget =
	| {
			readonly kind: "runtime";
			readonly itemId: string;
			readonly origin: HTMLElement | null;
	  }
	| {
			readonly kind: "definition";
			readonly itemUid: string;
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
			readonly exitDelayMs: number;
	  };

export interface CloseItemDetailProps {
	readonly restoreFocus?: boolean;
	readonly exitDelayMs?: number;
}

interface OpenItemDetailProps {
	readonly itemId: string;
	readonly origin?: HTMLElement | null;
}

interface OpenItemDefinitionDetailProps {
	readonly itemUid: string;
	readonly origin?: HTMLElement | null;
}

/** Canvas-local owner for one exact Item Detail modal. */
export interface ItemDetailControl {
	readonly state: ItemDetailState;
	readonly openItemDetailFx: (props: OpenItemDetailProps) => Effect.Effect<boolean, never, never>;
	readonly openItemDefinitionDetailFx: (
		props: OpenItemDefinitionDetailProps,
	) => Effect.Effect<boolean, never, never>;
	readonly closeAtom: Atom.AtomResultFn<CloseItemDetailProps | undefined, void, never>;
	readonly closeFx: (props?: CloseItemDetailProps) => Effect.Effect<void, never, never>;
	readonly completeEnterFx: (generation: number) => Effect.Effect<void, never, never>;
	readonly completeExitFx: (generation: number) => Effect.Effect<void, never, never>;
}
