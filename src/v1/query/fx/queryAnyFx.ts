import { Effect, Ref } from "effect";

import type { QueryAnySchema } from "~/v1/query/schema/QueryAnySchema";
import { RuntimeFx } from "~/v1/runtime/context/RuntimeFx";
import { queryItemsFx } from "./queryItemsFx";

export namespace queryAnyFx {
	export interface Props {
		query: QueryAnySchema.Type;
	}
}

/**
 * Selects matching items across every runtime location without a distance rule.
 */
export const queryAnyFx = Effect.fn("queryAnyFx")(function* ({ query }: queryAnyFx.Props) {
	const runtimeRef = yield* RuntimeFx;
	const runtime = yield* Ref.get(runtimeRef);

	return yield* queryItemsFx({
		items: runtime.items,
		selector: query.selector,
	});
});
