import { Effect } from "effect";

import type { ArkpackStorage } from "~/arkpack/renderer/ArkpackStorage";
import { readArkpackFx } from "~/arkpack/renderer/readArkpackFx";
import { ArkiniVersionIncompatibleError } from "~/engine/version/ArkiniVersionAdmission";

/** Selects the first valid user-first candidate while keeping decode authority in the renderer. */
export const readArkpackCandidatesFx = Effect.fn("readArkpackCandidatesFx")(function* (
	files: ReadonlyArray<ArkpackStorage.File>,
) {
	const candidates = [
		...files,
	].sort((left, right) => (left.source === right.source ? 0 : left.source === "user" ? -1 : 1));
	let incompatibility: ArkiniVersionIncompatibleError | undefined;
	for (const file of candidates) {
		const result = yield* Effect.result(
			readArkpackFx({
				bytes: new Uint8Array(file.bytes),
				filename: file.filename,
				packageId: file.packageId,
				provenance: file.provenance,
				source: file.source,
				overridesBundled: file.overridesBundled,
			}),
		);
		if (result._tag === "Success") return result.success;
		if (result.failure instanceof ArkiniVersionIncompatibleError)
			incompatibility ??= result.failure;
	}
	if (incompatibility !== undefined) return yield* Effect.fail(incompatibility);
	return undefined;
});
