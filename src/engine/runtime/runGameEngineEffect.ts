import { Effect, type Effect as EffectType } from "effect";
import type { RandomService } from "~/random/context/RandomService";
import { type RandomServiceFx } from "~/random/context/RandomServiceFx";
import { RandomServiceLive } from "~/random/RandomServiceLive";
import { withRandomService } from "~/random/withRandomService";

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
