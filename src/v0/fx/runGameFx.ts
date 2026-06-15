import type { Effect } from "effect";
import { bootstrapDatabase } from "~/v0/database/bootstrap/bootstrapDatabase";
import { type GameRuntimeServiceFx, runEffect } from "~/v0/fx/runEffect";

export namespace runGameFx {
	export interface Props<T, E> {
		effect: Effect.Effect<T, E, GameRuntimeServiceFx>;
	}
}

export const runGameFx = async <T, E>({ effect }: runGameFx.Props<T, E>) => {
	await bootstrapDatabase();
	return runEffect(effect);
};
