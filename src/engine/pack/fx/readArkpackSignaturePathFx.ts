import { Effect } from "effect";

/** Derives the canonical detached-sidecar path from one `.arkpack` path. */
export const readArkpackSignaturePathFx = Effect.fn("readArkpackSignaturePathFx")(
	(arkpackPath: string) => Effect.succeed(`${arkpackPath}.sig`),
);
