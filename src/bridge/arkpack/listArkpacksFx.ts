import { Effect } from "effect";
import type { ArkpackDescriptor } from "~/bridge/arkpack/Arkpack";
import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { ArkiniArkpack } from "~/bridge/arkpack/ArkiniArkpack";
import { createArkpackStorageFx } from "~/bridge/arkpack/createArkpackStorageFx";

export namespace listArkpacksFx {
	export interface Props {
		storage?: ArkpackStorage;
	}
}

/** Lists official Arkini followed by imported metadata without reading imported payload bytes. */
export const listArkpacksFx = Effect.fn("listArkpacksFx")(function* (
	props: listArkpacksFx.Props = {},
) {
	const storage = props.storage ?? (yield* createArkpackStorageFx());
	const imported = yield* storage.listFx;
	return [
		ArkiniArkpack.descriptor,
		...imported,
	] satisfies ReadonlyArray<ArkpackDescriptor>;
});
