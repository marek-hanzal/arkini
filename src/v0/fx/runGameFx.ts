import type { Effect } from "effect";
import { bootstrapDatabase } from "~/play/logic/bootstrapDatabase";
import { type GameRuntimeServiceFx, runEffect } from "~/play/logic/runEffect";

export namespace runGameFx {
	export interface Props<T, E, R extends GameRuntimeServiceFx> {
		effect: Effect.Effect<T, E, R>;
	}
}

export const runGameFx = async <T, E, R extends GameRuntimeServiceFx>({
	effect,
}: runGameFx.Props<T, E, R>) => {
	await bootstrapDatabase();
	return runEffect(effect);
};
