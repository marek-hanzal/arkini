import type { Effect } from "effect";
import type { KyselyContextFx } from "~/database/context/KyselyContextFx";
import type { GameActionError } from "~/command/GameActionError";
import type { DbHandle } from "./DbHandle";
import { dbFxImpl } from "./dbFxImpl";

/**
 * GPT:FIX
 * Types should be infered from TS, not hardcoded as this lies to parent Effect
 */
export const dbFx = <TResult>(
	run: (db: DbHandle) => Promise<TResult>,
): Effect.Effect<TResult, GameActionError, KyselyContextFx> => dbFxImpl(run);
