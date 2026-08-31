import { Effect } from "effect";

import type { Game } from "~/installed-game/type/Game";

/** Runs service-free read effects for test-only Game fixtures. */
export const testGameRead = ((effect: Effect.Effect<unknown, unknown>) =>
	Effect.runSyncExit(effect)) as Game["readFn"];
