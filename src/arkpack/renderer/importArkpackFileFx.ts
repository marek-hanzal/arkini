import { Effect } from "effect";

import { ArkpackLimits } from "../../../shared/ArkpackLimits";
import type { ArkpackStorage } from "~/arkpack/renderer/ArkpackStorage";
import { importArkpackFx } from "~/arkpack/renderer/importArkpackFx";

interface ArkpackFileInput {
	readonly name: string;
	readonly size: number;
	readonly arrayBuffer: () => Promise<ArrayBuffer>;
}

export namespace importArkpackFileFx {
	export interface Props {
		readonly file: ArkpackFileInput;
		readonly storage?: ArkpackStorage;
	}
}

/** Rejects oversized renderer-selected files before allocation, then validates and persists exact bytes. */
export const importArkpackFileFx = Effect.fn("importArkpackFileFx")(function* ({
	file,
	storage,
}: importArkpackFileFx.Props) {
	if (file.size > ArkpackLimits.maxArkpackBytes) {
		return yield* Effect.fail(
			new Error(`Arkpack exceeds the ${ArkpackLimits.maxArkpackBytes} byte limit.`),
		);
	}
	const bytes = yield* Effect.tryPromise({
		try: async () => new Uint8Array(await file.arrayBuffer()),
		catch: (cause) => cause,
	});
	return yield* importArkpackFx({
		bytes,
		filename: file.name,
		...(storage === undefined
			? {}
			: {
					storage,
				}),
	});
});
