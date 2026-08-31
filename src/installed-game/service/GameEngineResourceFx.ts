import { Context, type Effect, type Scope } from "effect";

import type { CriticalGameLifecycleError } from "~/playable-game/error/CriticalGameLifecycleError";
import type { InstalledGameEngineResource } from "~/installed-game/type/Game";

declare const GameEngineLeaseTypeId: unique symbol;

/** Opaque scoped claim on one exact renderer Game resource acquisition. */
export interface GameEngineLease {
	readonly [GameEngineLeaseTypeId]: typeof GameEngineLeaseTypeId;
	readonly resource: InstalledGameEngineResource;
}

export namespace GameEngineResourceFx {
	export interface AcquireProps {
		readonly packageId: string;
	}

	export interface ReleaseProps {
		readonly allowAlreadyFinalized?: boolean;
		readonly resource: InstalledGameEngineResource;
	}

	export interface ResetProps {
		readonly resource: InstalledGameEngineResource;
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
	readonly currentFx: Effect.Effect<
		InstalledGameEngineResource | null,
		CriticalGameLifecycleError,
		never
	>;
	/**
	 * Joins every in-flight ownership transition before handing the renderer to
	 * an Editor game. An active resource is returned so its save route can own
	 * the final handoff; provisional ownership is cancelled here.
	 */
	readonly prepareEditorHandoffFx: Effect.Effect<
		InstalledGameEngineResource | null,
		CriticalGameLifecycleError,
		never
	>;
	/**
	 * Acquires one scoped lease. Its Scope owns provisional cleanup until the
	 * exact lease is adopted by the route.
	 */
	readonly acquireLeaseFx: (
		props: GameEngineResourceFx.AcquireProps,
	) => Effect.Effect<GameEngineLease, unknown, Scope.Scope>;
	readonly adoptLeaseFx: (
		lease: GameEngineLease,
	) => Effect.Effect<InstalledGameEngineResource, unknown, never>;
	/**
	 * Claims a pending provisional resource for native close before route
	 * interruption can release its final consumer.
	 */
	readonly claimForCloseFx: Effect.Effect<
		InstalledGameEngineResource | null,
		CriticalGameLifecycleError,
		never
	>;
	readonly releaseFx: (
		props: GameEngineResourceFx.ReleaseProps,
	) => Effect.Effect<void, unknown, never>;
	readonly resetFx: (
		props: GameEngineResourceFx.ResetProps,
	) => Effect.Effect<void, unknown, never>;
	readonly closeFx: (
		resource: InstalledGameEngineResource,
	) => Effect.Effect<GameEngineResourceFx.CloseResult, never, never>;
	readonly discardFailedFx: (packageId: string) => Effect.Effect<void, unknown, never>;
	readonly recoverFailedSaveFx: (
		props: GameEngineResourceFx.RecoverFailedSaveProps,
	) => Effect.Effect<void, unknown, never>;
}

/** One Effect-owned renderer authority for Game acquisition and finalization. */
export class GameEngineResourceFx extends Context.Service<
	GameEngineResourceFx,
	GameEngineResourceFxService
>()("GameEngineResourceFx") {
	//
}
