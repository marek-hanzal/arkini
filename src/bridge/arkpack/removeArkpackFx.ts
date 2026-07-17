import { Effect } from "effect";
import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { createArkpackStorageFx } from "~/bridge/arkpack/createArkpackStorageFx";

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
	const storage = providedStorage ?? (yield* createArkpackStorageFx());
	yield* storage.removeFx(packageId);
});
