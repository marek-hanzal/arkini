import { Effect } from "effect";
import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { createArkpackStorageFx } from "~/bridge/arkpack/createArkpackStorageFx";
import { readArkpackCandidatesFx } from "~/bridge/arkpack/readArkpackCandidatesFx";

export namespace listArkpacksFx {
	export interface Props {
		storage?: ArkpackStorage;
	}
}

/** Reads and validates the effective package set exposed by the two filesystem roots. */
export const listArkpacksFx = Effect.fn("listArkpacksFx")(function* (
	props: listArkpacksFx.Props = {},
) {
	const storage = props.storage ?? (yield* createArkpackStorageFx());
	const files = yield* storage.listFx;
	const candidates = new Map<string, ArkpackStorage.File[]>();
	for (const file of files) {
		const packageFiles = candidates.get(file.packageId) ?? [];
		packageFiles.push(file);
		candidates.set(file.packageId, packageFiles);
	}
	return yield* Effect.forEach(
		candidates.values(),
		(files) =>
			readArkpackCandidatesFx(files).pipe(Effect.map((loaded) => loaded?.descriptor ?? null)),
		{
			concurrency: 4,
		},
	).pipe(Effect.map((descriptors) => descriptors.filter((descriptor) => descriptor !== null)));
});
