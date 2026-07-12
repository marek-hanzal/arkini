import { Context, type Stream } from "effect";

import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export interface RuntimeChangesFxService {
	/** Emits the current committed runtime and every subsequent successful commit. */
	readonly changes: Stream.Stream<RuntimeSchema.Type>;
}

/** Read-only stream of committed gameplay runtime snapshots. */
export class RuntimeChangesFx extends Context.Tag("RuntimeChangesFx")<
	RuntimeChangesFx,
	RuntimeChangesFxService
>() {
	//
}
