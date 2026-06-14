import type { Effect } from "effect";
import type { KyselyContextFx } from "~/database/context/KyselyContextFx";
import type { GameActionError } from "~/play/logic/playTypes";
import type { DbHandle } from "./DbHandle";
import { dbFxImpl } from "./dbFxImpl";

export const dbFx = <TResult>(
	run: (db: DbHandle) => Promise<TResult>,
): Effect.Effect<TResult, GameActionError, KyselyContextFx> => dbFxImpl(run);
