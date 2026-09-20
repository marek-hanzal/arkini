import { userInfo } from "node:os";
import { Effect } from "effect";

import { createSerakkiUserDataPathsFn } from "~/application-data/fn/createSerakkiUserDataPathsFn";

/** Reads the effective user's system-owned home and resolves the one Serakki data root. */
export const resolveSerakkiUserDataPathsFx = Effect.try({
	try: () => createSerakkiUserDataPathsFn(userInfo().homedir),
	catch: (cause) => cause,
});
