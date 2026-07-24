import type { QueryClient } from "@tanstack/react-query";

import type { CriticalGameLifecycleError } from "~/bridge/game/CriticalGameLifecycleError";
import type { GameEngineResource } from "~/bridge/game/GameEngineResource";

export interface GameEngineAcquisitionOwner {
	readonly controller: AbortController;
	readonly consumers: Set<GameEngineAcquisitionOwner.Consumer>;
	readonly packageId: string;
	readonly queryClient: QueryClient;
	readonly result: Promise<GameEngineResource>;
	adopted: boolean;
	cancelling: Promise<void> | undefined;
	criticalFailure: CriticalGameLifecycleError | undefined;
}

export namespace GameEngineAcquisitionOwner {
	export interface Consumer {
		readonly abort: Promise<never>;
		readonly removeAbortListener: () => void;
	}
}
