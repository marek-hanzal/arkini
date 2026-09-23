import type { Effect } from "effect";

import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";

export interface PresentationTarget {
	readonly size: number;
	readonly x: number;
	readonly y: number;
}

/** Owns live gameplay feedback requests, never canonical gameplay or pointer gestures. */
export interface PresentationRuntime {
	readonly arriveFromFx: (props: {
		readonly actor: PixiTileActor;
		readonly origin: PresentationTarget;
		readonly readTargetFn: () => PresentationTarget | null;
		readonly target: PresentationTarget;
		readonly onCompleteFn?: () => void;
	}) => Effect.Effect<void, never, never>;
	readonly appearFx: (props: {
		readonly actor: PixiTileActor;
		readonly delayMs?: number;
		readonly onCompleteFn?: () => void;
	}) => Effect.Effect<void, never, never>;
	readonly disappearFx: (props: {
		readonly actor: PixiTileActor;
		readonly onCompleteFn?: () => void;
	}) => Effect.Effect<void, never, never>;
	readonly crossfadeFx: (props: {
		readonly incoming: PixiTileActor;
		readonly outgoing: PixiTileActor;
		readonly onCompleteFn?: () => void;
	}) => Effect.Effect<void, never, never>;
	readonly crossfadeArtworkFx: (props: {
		readonly actor: PixiTileActor;
		readonly onCompleteFn: () => void;
	}) => Effect.Effect<void, never, never>;
	readonly travelFx: (props: {
		readonly actor: PixiTileActor;
		readonly onCompleteFn?: () => void;
		readonly readTargetFn: () => PresentationTarget | null;
		readonly target: PresentationTarget;
	}) => Effect.Effect<void, never, never>;
	readonly exitBoardFx: (onCompleteFn: () => void) => Effect.Effect<void, never, never>;
	readonly enterBoardFx: (onCompleteFn: () => void) => Effect.Effect<void, never, never>;
	readonly cancelActorFx: (actor: PixiTileActor) => Effect.Effect<void, never, never>;
	readonly isTravelingFx: (actor: PixiTileActor) => Effect.Effect<boolean, never, never>;
	readonly cancelAllFx: Effect.Effect<void, never, never>;
	readonly closeFx: Effect.Effect<void, never, never>;
}
