import { Effect } from "effect";

import { ArkiniPublicKey } from "~/bridge/arkpack/ArkiniPublicKey";
import { readArkpackFx } from "~/bridge/arkpack/readArkpackFx";
import { ArkpackLimits } from "../../../../shared/ArkpackLimits";

export interface EditorArkpackFileInput {
	readonly name: string;
	readonly size: number;
	readonly arrayBuffer: () => Promise<ArrayBuffer>;
}

/** Reads one user-selected arkpack through the canonical validation boundary. */
export const readEditorArkpackFileFx = Effect.fn("readEditorArkpackFileFx")(function* (
	file: EditorArkpackFileInput,
) {
	if (!file.name.toLowerCase().endsWith(".arkpack")) {
		return yield* Effect.fail(new Error("Choose a .arkpack file."));
	}
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
	return yield* readArkpackFx({
		bytes,
		filename: file.name,
		signature: {
			publicKey: ArkiniPublicKey,
		},
		source: "user",
	});
});
