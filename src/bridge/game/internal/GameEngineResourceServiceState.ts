import type { Cause, Deferred, Fiber } from "effect";

import type { CriticalGameLifecycleError } from "~/bridge/game/CriticalGameLifecycleError";
import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import type { GameEngineLease } from "~/bridge/game/GameEngineResourceFx";
import type { GameSaveBootstrapError } from "~/bridge/game/GameSaveBootstrapError";

export interface AcquisitionOwner {
	readonly id: number;
	readonly packageId: string;
	readonly closeClaims: Set<symbol>;
	readonly consumers: Set<symbol>;
	readonly result: Deferred.Deferred<GameEngineResource, unknown>;
	fiber: Fiber.Fiber<GameEngineResource, unknown> | undefined;
	resource: GameEngineResource | undefined;
}

export interface LeaseRecord {
	readonly owner: AcquisitionOwner | undefined;
	readonly token: symbol;
}

export const LeaseRecordTypeId = Symbol("GameEngineLeaseRecord");

export type InternalGameEngineLease = GameEngineLease & {
	readonly [LeaseRecordTypeId]: LeaseRecord;
};

export interface Cancellation {
	readonly owner: AcquisitionOwner;
	readonly completion: Deferred.Deferred<void, CriticalGameLifecycleError>;
}

export interface Finalization {
	readonly resource: GameEngineResource;
	readonly operation: "release" | "reset";
	readonly completion: Deferred.Deferred<void, CriticalGameLifecycleError>;
}

export interface FailedSaveRecovery {
	readonly packageId: string;
	readonly bootstrapCause: Cause.Cause<unknown>;
	readonly error: GameSaveBootstrapError;
	readonly completion: Deferred.Deferred<void, unknown>;
}

export type GameEngineResourceServiceState =
	| {
			readonly _tag: "Idle";
			readonly lastFinalized: GameEngineResource | undefined;
	  }
	| {
			readonly _tag: "Acquiring";
			readonly owner: AcquisitionOwner;
	  }
	| {
			readonly _tag: "Provisional";
			readonly owner: AcquisitionOwner;
			readonly resource: GameEngineResource;
	  }
	| {
			readonly _tag: "Cancelling";
			readonly cancellation: Cancellation;
	  }
	| {
			readonly _tag: "Active";
			readonly resource: GameEngineResource;
	  }
	| {
			readonly _tag: "Finalizing";
			readonly finalization: Finalization;
	  }
	| {
			readonly _tag: "BootstrapFailed";
			readonly packageId: string;
			readonly cause: Cause.Cause<unknown>;
	  }
	| {
			readonly _tag: "RecoveringFailedSave";
			readonly recovery: FailedSaveRecovery;
	  }
	| {
			readonly _tag: "OwnershipFailed";
			readonly error: CriticalGameLifecycleError;
			/**
			 * Present when ownership failed after a terminal operation started.
			 * Controlled close may only observe that exact settled result.
			 */
			readonly finalization: Finalization | undefined;
	  };
