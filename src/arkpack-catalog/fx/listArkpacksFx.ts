import { Effect } from "effect";

import { ArkiniVersionSchema } from "~/application-version/schema/ArkiniVersionSchema";
import { createElectronArkpackStorageFx } from "~/arkpack-catalog/fx/createElectronArkpackStorageFx";
import type { ArkpackStorage } from "~/arkpack-catalog/service/ArkpackStorage";
import { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";

export namespace listArkpacksFx {
	export interface Props {
		storage?: ArkpackStorage;
	}
}

/** Lists validated package descriptors without loading installed resource bodies. */
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
	return yield* Effect.forEach(grouped.values(), (candidates) =>
		Effect.gen(function* () {
			const ordered = [
				...candidates,
			].sort((left, right) =>
				left.source === right.source ? 0 : left.source === "user" ? -1 : 1,
			);
			for (const file of ordered) {
				const descriptor = yield* Effect.sync(() => {
					try {
						return {
							packageId: file.packageId,
							contentHash: file.contentHash,
							title: file.title,
							version: GameVersionSchema.parse(file.version),
							arkini: ArkiniVersionSchema.parse(file.arkini),
							provenance: file.provenance,
							source: file.source,
							overridesBundled: file.overridesBundled,
							filename: file.filename,
						};
					} catch {
						return null;
					}
				});
				if (descriptor !== null) return descriptor;
			}
			return null;
		}),
	).pipe(Effect.map((descriptors) => descriptors.filter((descriptor) => descriptor !== null)));
});
