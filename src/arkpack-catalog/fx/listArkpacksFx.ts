import { Effect } from "effect";
import type { ArkpackStorage } from "~/arkpack-catalog/service/ArkpackStorage";
import { createElectronArkpackStorageFx } from "~/arkpack-catalog/fx/createElectronArkpackStorageFx";
import { readArkpackFx } from "~/arkpack-admission/fx/readArkpackFx";
import { ArkiniVersionSchema } from "~/application-version/schema/ArkiniVersionSchema";
import { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";

export namespace listArkpacksFx {
	export interface Props {
		storage?: ArkpackStorage;
	}
}

/** Lists inspected package descriptors without loading Electron resource bodies. */
export const listArkpacksFx = Effect.fn("listArkpacksFx")(function* (
	props: listArkpacksFx.Props = {},
) {
	const storage = props.storage ?? (yield* createElectronArkpackStorageFx());
	const files = yield* storage.listFx;
	const grouped = new Map<string, ArkpackStorage.Candidate[]>();
	for (const file of files) {
		const candidates = grouped.get(file.packageId) ?? [];
		candidates.push(file);
		grouped.set(file.packageId, candidates);
	}
	return yield* Effect.forEach(
		grouped.values(),
		(candidates) =>
			Effect.gen(function* () {
				const ordered = [
					...candidates,
				].sort((left, right) =>
					left.source === right.source ? 0 : left.source === "user" ? -1 : 1,
				);
				for (const file of ordered) {
					const descriptor = yield* "bytes" in file
						? readArkpackFx({
								bytes: new Uint8Array(file.bytes),
								filename: file.filename,
								packageId: file.packageId,
								provenance: file.provenance,
								source: file.source,
								overridesBundled: file.overridesBundled,
							}).pipe(
								Effect.map(({ descriptor }) => descriptor),
								Effect.catch(() => Effect.succeed(null)),
							)
						: Effect.try({
								try: () => ({
									packageId: file.packageId,
									contentHash: file.contentHash,
									title: file.title,
									version: GameVersionSchema.parse(file.version),
									arkini: ArkiniVersionSchema.parse(file.arkini),
									provenance: file.provenance,
									source: file.source,
									overridesBundled: file.overridesBundled,
									filename: file.filename,
								}),
								catch: () => null,
							});
					if (descriptor !== null) return descriptor;
				}
				return null;
			}),
		{
			concurrency: 4,
		},
	).pipe(Effect.map((descriptors) => descriptors.filter((descriptor) => descriptor !== null)));
});
