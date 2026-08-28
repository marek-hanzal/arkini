import { Context, type Effect, type Scope } from "effect";

import type { CriticalGameLifecycleError } from "~/renderer/game/resource/CriticalGameLifecycleError";
import type { GameEngineResource } from "~/renderer/game/resource/GameEngineResource";

declare const GameEngineLeaseTypeId: unique symbol;

/** Opaque scoped claim on one exact renderer Game resource acquisition. */
export interface GameEngineLease {
	readonly [GameEngineLeaseTypeId]: typeof GameEngineLeaseTypeId;
	readonly resource: GameEngineResource;
}

export namespace GameEngineResourceFx {
	export interface AcquireProps {
		readonly packageId: string;
	}

	export interface ReleaseProps {
		readonly allowAlreadyFinalized?: boolean;
		readonly resource: GameEngineResource;
	}

	export interface ResetProps {
		readonly resource: GameEngineResource;
	}

	export interface RecoverFailedSaveProps {
		readonly packageId: string;
	}

	export type CloseResult =
		| {
				readonly type: "saved";
		  }
		| {
				readonly type: "finalization-failed";
				readonly cause: unknown;
		  };
}

export interface GameEngineResourceFxService {
	/** Reads only the adopted or currently finalizing renderer Game. */
	readonly currentFx: Effect.Effect<GameEngineResource | null, CriticalGameLifecycleError>;
	/**
	 * Joins every in-flight ownership transition before handing the renderer to
	 * an Editor game. An active resource is returned so its save route can own
	 * the final handoff; provisional ownership is cancelled here.
	 */
	readonly prepareEditorHandoffFx: Effect.Effect<
		GameEngineResource | null,
		CriticalGameLifecycleError
	>;
	/**
	 * Acquires one scoped lease. Its Scope owns provisional cleanup until the
	 * exact lease is adopted by the route.
	 */
	readonly acquireLeaseFx: (
		props: GameEngineResourceFx.AcquireProps,
	) => Effect.Effect<GameEngineLease, unknown, Scope.Scope>;
	readonly adoptLeaseFx: (lease: GameEngineLease) => Effect.Effect<GameEngineResource, unknown>;
	/**
	 * Claims a pending provisional resource for native close before route
	 * interruption can release its final consumer.
	 */
	readonly claimForCloseFx: Effect.Effect<GameEngineResource | null, CriticalGameLifecycleError>;
	readonly releaseFx: (props: GameEngineResourceFx.ReleaseProps) => Effect.Effect<void, unknown>;
	readonly resetFx: (props: GameEngineResourceFx.ResetProps) => Effect.Effect<void, unknown>;
	readonly closeFx: (
		resource: GameEngineResource,
	) => Effect.Effect<GameEngineResourceFx.CloseResult>;
	readonly discardFailedFx: (packageId: string) => Effect.Effect<void, unknown>;
	readonly recoverFailedSaveFx: (
		props: GameEngineResourceFx.RecoverFailedSaveProps,
	) => Effect.Effect<void, unknown>;
}

/** One Effect-owned renderer authority for Game acquisition and finalization. */
export class GameEngineResourceFx extends Context.Service<
	GameEngineResourceFx,
	GameEngineResourceFxService
>()("GameEngineResourceFx") {
	//
}
