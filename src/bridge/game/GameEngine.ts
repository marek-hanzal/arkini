import type { Effect } from "effect";
import type * as Atom from "effect/unstable/reactivity/Atom";

import type { CriticalGameLifecycleOperation } from "~/bridge/game/CriticalGameLifecycleError";
import type { GameSessionNotRunningError } from "~/bridge/game/GameSessionNotRunningError";
import type { GameEngineServices, GameTransition } from "~/bridge/game/GameSession";
import type { GameEventBatchSchema } from "~/engine/event/schema/GameEventBatchSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

/** Presentation-facing facade whose live reads preserve the exact session fail-stop boundary. */
export interface GameEngine<Metadata extends GameEngine.Metadata = GameEngine.Metadata> {
	/** Immutable identity needed by the route presenting this exact session. */
	readonly resourceMetadata: Metadata;
	/** Correlates renderer command diagnostics when this session installs them. */
	readonly diagnosticSessionId?: string;
	readonly config: GameConfigSchema.Type;
	readonly getResourceUrl: (resourceId: string) => string;
	/** Read-only React projection of the canonical committed transition. */
	readonly committedTransitionAtom: Atom.Atom<GameTransition>;
	readonly getTransitionSnapshot: () => GameTransition;
	readonly subscribeTransitions: (
		listener: (transition: GameTransition) => void | PromiseLike<void>,
	) => () => void;
	readonly subscribeEvents: (
		listener: (batch: GameEventBatchSchema.Type) => void | PromiseLike<void>,
	) => () => void;
	/** Publishes a renderer-side critical failure into this exact resource. */
	readonly reportCriticalFailure: (
		operation: Extract<CriticalGameLifecycleOperation, "game-presentation" | "game-runtime">,
		cause: unknown,
	) => void;
	readonly readOrThrow: <Result, Error, Requirements extends GameEngineServices>(
		effect: Effect.Effect<Result, Error, Requirements>,
	) => Result;
	/** Runs one directly imported Engine Effect inside this session's ManagedRuntime. */
	readonly runEngineFx: <Result, Error, Requirements extends GameEngineServices>(
		effect: Effect.Effect<Result, Error, Requirements>,
	) => Effect.Effect<Result, Error | GameSessionNotRunningError>;
	/** Flushes this exact session's durable save capability. */
	readonly saveFx: Effect.Effect<void, unknown>;
}

export namespace GameEngine {
	export interface PackageMetadata {
		readonly type: "package";
		readonly packageId: string;
	}

	export interface EditorMetadata {
		readonly type: "editor";
		readonly projectId: string;
		readonly projectRevision: number;
	}

	export type Metadata = PackageMetadata | EditorMetadata;
}

/** Installed-package facade used by package routes and durable lifecycle operations. */
export type PackageGameEngine = GameEngine<GameEngine.PackageMetadata>;
