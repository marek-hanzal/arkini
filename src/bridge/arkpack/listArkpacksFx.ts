import { Effect } from "effect";
import type { ArkpackDescriptor } from "~/bridge/arkpack/Arkpack";
import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { BuiltInArkpacks } from "~/bridge/arkpack/BuiltInArkpacks";
import { createArkpackStorageFx } from "~/bridge/arkpack/createArkpackStorageFx";

export namespace listArkpacksFx {
	export interface Props {
		storage?: ArkpackStorage;
	}
}

/** Lists bundled packages followed by imported metadata without reading package payload bytes. */
export const listArkpacksFx = Effect.fn("listArkpacksFx")(function* (
	props: listArkpacksFx.Props = {},
) {
	const storage = props.storage ?? (yield* createArkpackStorageFx());
	const imported = yield* storage.listFx;
	return [
		...BuiltInArkpacks.map((arkpack) => arkpack.descriptor),
		...imported,
	] satisfies ReadonlyArray<ArkpackDescriptor>;
});
