import { Effect } from "effect";

import { ArkpackLimits } from "~/bridge/arkpack/ArkpackLimits";
import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { importArkpackFx } from "~/bridge/arkpack/importArkpackFx";

export namespace importArkpackFileFx {
	export interface FileInput {
		readonly name: string;
		readonly size: number;
		readonly arrayBuffer: () => Promise<ArrayBuffer>;
	}

	export interface Props {
		readonly file: FileInput;
		readonly storage?: ArkpackStorage;
	}
}

/** Rejects oversized browser files before allocation, then validates and persists exact bytes. */
export const importArkpackFileFx = Effect.fn("importArkpackFileFx")(function* ({
	file,
	storage,
}: importArkpackFileFx.Props) {
	if (file.size > ArkpackLimits.maxCompressedBytes) {
		return yield* Effect.fail(
			new Error(
				`Arkpack exceeds the ${ArkpackLimits.maxCompressedBytes} byte compressed limit.`,
			),
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
