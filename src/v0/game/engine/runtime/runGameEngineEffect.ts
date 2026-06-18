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
 * The engine runtime only needs random numbers. Persistence wraps this adapter from
 * the outside instead of sneaking storage into gameplay rules wearing a fake beard.
 */
export const runGameEngineEffect = <A, E>(
	effect: EffectType.Effect<A, E, GameEngineRuntimeServiceFx>,
	options: runGameEngineEffect.Options = {},
) => Effect.runPromise(effect.pipe(withRandomService(options.random ?? RandomServiceLive)));
