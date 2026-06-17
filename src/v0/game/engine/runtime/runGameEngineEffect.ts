import { Effect, type Effect as EffectType } from "effect";
import type { RandomService } from "~/v0/random/context/RandomService";
import { type RandomServiceFx } from "~/v0/random/context/RandomServiceFx";
import { RandomServiceLive } from "~/v0/random/logic/RandomServiceLive";
import { withRandomService } from "~/v0/random/logic/withRandomService";

export type GameEngineRuntimeServiceFx = RandomServiceFx;

export namespace runGameEngineEffect {
	export interface Options {
		random?: RandomService;
	}
}

/**
 * Minimal standalone runner for the new tick/action engine.
 *
 * This intentionally does not use the app-level `runEffect`, because that runner still
 * wires Kysely/SQLite/browser storage. The engine runtime only needs random numbers;
 * persistence should wrap the engine later, not sneak into it now wearing a fake beard.
 */
export const runGameEngineEffect = <A, E>(
	effect: EffectType.Effect<A, E, GameEngineRuntimeServiceFx>,
	options: runGameEngineEffect.Options = {},
) => Effect.runPromise(effect.pipe(withRandomService(options.random ?? RandomServiceLive)));
