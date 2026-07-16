import { Effect } from "effect";

import type { ArkpackDescriptor } from "~/bridge/arkpack/Arkpack";
import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { ArkiniArkpack } from "~/bridge/arkpack/ArkiniArkpack";
import { createArkpackStorage } from "~/bridge/arkpack/createArkpackStorage";
import { loadArkpackFx } from "~/bridge/arkpack/loadArkpackFx";

export namespace listArkpacksFx {
	export interface Props {
		storage?: ArkpackStorage;
	}
}

/** Lists official Arkini followed by imported metadata without reading imported payload bytes. */
export const listArkpacksFx = Effect.fn("listArkpacksFx")(function* (
	props: listArkpacksFx.Props = {},
) {
	const storage = props.storage ?? createArkpackStorage();
	return yield* Effect.gen(function* () {
		const arkini = yield* loadArkpackFx({
			packageId: ArkiniArkpack.packageId,
		});
		const imported = yield* Effect.tryPromise({
			try: () => storage.list(),
			catch: (cause) => cause,
		});
		return [
			arkini.descriptor,
			...imported,
		] satisfies ReadonlyArray<ArkpackDescriptor>;
	}).pipe(Effect.ensuring(Effect.sync(() => props.storage === undefined && storage.close())));
});
