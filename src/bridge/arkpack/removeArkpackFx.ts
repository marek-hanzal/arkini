import { Effect } from "effect";

import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { createArkpackStorage } from "~/bridge/arkpack/createArkpackStorage";

export namespace removeArkpackFx {
	export interface Props {
		packageId: string;
		storage?: ArkpackStorage;
	}
}

/** Removes one imported package binary while leaving its separately namespaced save intact. */
export const removeArkpackFx = Effect.fn("removeArkpackFx")(function* ({
	packageId,
	storage: providedStorage,
}: removeArkpackFx.Props) {
	const storage = providedStorage ?? createArkpackStorage();
	return yield* Effect.tryPromise({
		try: () => storage.remove(packageId),
		catch: (cause) => cause,
	}).pipe(Effect.ensuring(Effect.sync(() => providedStorage === undefined && storage.close())));
});
