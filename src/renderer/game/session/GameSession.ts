import type { Effect, Exit } from "effect";
import type * as LayerModule from "effect/Layer";
import type * as Atom from "effect/unstable/reactivity/Atom";

import type { GameSessionNotRunningError } from "~/renderer/game/session/GameSessionNotRunningError";
import type {
	GameSessionFatalError,
	GameSessionFatalSource,
} from "~/renderer/game/session/GameSessionFatalError";
import type { RuntimeSaveFx } from "~/engine/save/RuntimeSaveFx";
import type { GameEventBatchSchema } from "~/game-event/schema/GameEventBatchSchema";
import type { GameSessionLayerFx } from "~/engine/game/layer/GameSessionLayerFx";
import type { CommittedTransitionSchema } from "~/game-runtime/schema/CommittedTransitionSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export type GameSessionServices =
	| LayerModule.Success<ReturnType<typeof GameSessionLayerFx>>
	| RuntimeSaveFx;

/** Exact committed game fact exposed to renderer presentation. */
export type GameTransition = CommittedTransitionSchema.Type;

/**
 * Stable renderer-facing owner of one loaded game's Effect services and resources.
 *
 * TODO(#397): Migrate the Atom-facing type directly to the stable Effect API without
 * weakening the session's runtime, command, subscription, or disposal ownership.
 */
export interface GameSession {
	/** Saves and releases the session; a failed final save leaves it frozen and retryable. */
	readonly disposeFx: Effect.Effect<void, unknown>;
	/** Destructive disposal for hard reset or an unpublished bootstrap. */
	readonly disposeWithoutSaveFx: Effect.Effect<void, unknown>;
	readonly flushSaveFx: Effect.Effect<void, unknown>;
	/** Read-only renderer projection of the authoritative committed transition source. */
	readonly committedTransitionAtom: Atom.Atom<GameTransition>;
	readonly getSnapshot: () => RuntimeSchema.Type;
	/** Latest exact runtime plus the ordered facts and bounded outgoing snapshot for that commit. */
	readonly getTransitionSnapshot: () => GameTransition;
	/** The exact first background failure that permanently froze this session. */
	readonly getFatalError: () => GameSessionFatalError | null;
	/** Synchronously freezes this exact session on its first unrecoverable failure. */
	readonly failStop: (source: GameSessionFatalSource, cause: unknown) => GameSessionFatalError;
	/** Notifies once when this exact session first becomes fatally unusable. */
	readonly subscribeFatalError: (listener: () => void) => () => void;
	/**
	 * Executes one synchronous query inside this Game's existing session runtime.
	 * Read and run are lifecycle modes, not type-level authority barriers.
	 */
	readonly read: <Result, Error, Requirements extends GameSessionServices>(
		effect: Effect.Effect<Result, Error, Requirements>,
	) => Exit.Exit<Result, Error | GameSessionNotRunningError>;
	/** Runs one typed, interruptible command owned by this session's command scope. */
	readonly runFx: <Result, Error, Requirements extends GameSessionServices>(
		effect: Effect.Effect<Result, Error, Requirements>,
	) => Effect.Effect<Result, Error | GameSessionNotRunningError>;
	/** Promise edge retained for non-Effect callers; implemented by `runFx`. */
	readonly run: <Result, Error, Requirements extends GameSessionServices>(
		effect: Effect.Effect<Result, Error, Requirements>,
	) => Promise<Result>;
	readonly subscribe: (listener: () => void | PromiseLike<void>) => () => void;
	/** Replays the atomically captured current transition, then every later commit in order. */
	readonly subscribeTransitions: (
		listener: (transition: GameTransition) => void | PromiseLike<void>,
	) => () => void;
	readonly subscribeEvents: (
		listener: (batch: GameEventBatchSchema.Type) => void | PromiseLike<void>,
	) => () => void;
}
