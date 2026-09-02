import { userInfo } from "node:os";
import { Effect } from "effect";

import { createArkiniUserDataPathsFn } from "~/application-data/fn/createArkiniUserDataPathsFn";

/** Reads the effective user's system-owned home and resolves the one Arkini data root. */
export const resolveArkiniUserDataPathsFx = Effect.try({
	try: () => createArkiniUserDataPathsFn(userInfo().homedir),
	catch: (cause) => cause,
});
