import { Effect } from "effect";

import type { Game } from "~/bridge/game/Game";
import type { GameEngine } from "~/bridge/game/GameEngine";

/** Runs service-free read effects for test-only Game fixtures. */
export const testGameRead = ((effect: Effect.Effect<unknown, unknown>) =>
	Effect.runSyncExit(effect)) as Game["read"];

/** Runs service-free read effects and throws their typed failure for GameEngine fixtures. */
export const testGameReadOrThrow = ((effect: Effect.Effect<unknown, unknown>) =>
	Effect.runSync(effect)) as GameEngine["readOrThrow"];
