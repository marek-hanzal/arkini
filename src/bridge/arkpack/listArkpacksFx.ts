import { Effect } from "effect";

import type { ArkpackDescriptor } from "~/bridge/arkpack/Arkpack";
import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { BuiltinArkpack } from "~/bridge/arkpack/BuiltinArkpack";
import { DexieArkpackStorage } from "~/bridge/arkpack/DexieArkpackStorage";
import { loadArkpackFx } from "~/bridge/arkpack/loadArkpackFx";

export namespace listArkpacksFx {
	export interface Props {
		storage?: ArkpackStorage;
	}
}

/** Lists the validated bundled Arkini package followed by every validated local import. */
export const listArkpacksFx = Effect.fn("listArkpacksFx")(function* (
	props: listArkpacksFx.Props = {},
) {
	const storage = props.storage ?? new DexieArkpackStorage();
	return yield* Effect.gen(function* () {
		const builtin = yield* loadArkpackFx({
			packageId: BuiltinArkpack.packageId,
		});
		const imported = yield* Effect.tryPromise({
			try: () => storage.list(),
			catch: (cause) => cause,
		});
		return [
			builtin.descriptor,
			...imported.map(({ bytes: _bytes, ...descriptor }) => descriptor),
		] satisfies ReadonlyArray<ArkpackDescriptor>;
	}).pipe(Effect.ensuring(Effect.sync(() => props.storage === undefined && storage.close())));
});
