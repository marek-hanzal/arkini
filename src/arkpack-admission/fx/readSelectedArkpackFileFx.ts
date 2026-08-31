import { Effect } from "effect";

import { readArkpackFx } from "~/arkpack-admission/fx/readArkpackFx";
import { ArkpackLimits } from "../../../shared/ArkpackLimits";

export interface EditorArkpackFileInput {
	readonly name: string;
	readonly size: number;
	readonly arrayBuffer: () => Promise<ArrayBuffer>;
}

/** Reads one user-selected arkpack through the canonical validation boundary. */
export const readSelectedArkpackFileFx = Effect.fn("readSelectedArkpackFileFx")(function* (
	file: EditorArkpackFileInput,
) {
	if (!file.name.toLowerCase().endsWith(".arkpack")) {
		return yield* Effect.fail(new Error("Choose a .arkpack file."));
	}
	if (file.size > ArkpackLimits.maxArkpackBytes) {
		return yield* Effect.fail(
			new Error(`Arkpack exceeds the ${ArkpackLimits.maxArkpackBytes} byte limit.`),
		);
	}
	const bytes = yield* Effect.tryPromise({
		try: async () => new Uint8Array(await file.arrayBuffer()),
		catch: (cause) => cause,
	});
	return yield* readArkpackFx({
		bytes,
		filename: file.name,
		provenance: {
			type: "community",
		},
		source: "user",
	});
});
