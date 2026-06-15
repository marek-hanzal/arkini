import type { Effect } from "effect";
import { bootstrapDatabase } from "~/play/logic/bootstrapDatabase";
import { type GameRuntimeServiceFx, runEffect } from "~/play/logic/runEffect";

export namespace runGameFx {
	export interface Props<T, E> {
		effect: Effect.Effect<T, E, GameRuntimeServiceFx>;
	}
}

export const runGameFx = async <T, E>({ effect }: runGameFx.Props<T, E>) => {
	await bootstrapDatabase();
	return runEffect(effect);
};
