import { Effect, type Effect as EffectType } from "effect";
import type { RandomService } from "~/random/context/RandomService";
import { type RandomServiceFx } from "~/random/context/RandomServiceFx";
import { RandomServiceLive } from "~/random/RandomServiceLive";
import { withRandomService } from "~/random/withRandomService";

export type GameRuntimeServiceFx = RandomServiceFx;

export namespace runGameRuntimeEffect {
	export interface Options {
		random?: RandomService;
	}
}

/**
 * UI/runtime edge runner for Effect programs that need runtime services.
 *
 * React hooks and providers should run gameplay/runtime effects here instead of
 * calling `Effect.runPromise` directly and sprinkling service provisioning around
 * the UI like confetti at a corporate offsite.
 */
export const runGameRuntimeEffect = <A, E>(
	effect: EffectType.Effect<A, E, GameRuntimeServiceFx>,
	options: runGameRuntimeEffect.Options = {},
) => Effect.runPromise(effect.pipe(withRandomService(options.random ?? RandomServiceLive)));
