import { compareSerapackSourcesFn } from "~/serapack-catalog/fn/compareSerapackSourcesFn";
import { Effect } from "effect";

import { SerakkiVersionSchema } from "~/application-version/schema/SerakkiVersionSchema";
import { createElectronSerapackStorageFx } from "~/serapack-catalog/fx/createElectronSerapackStorageFx";
import type { SerapackStorage } from "~/serapack-catalog/service/SerapackStorage";
import { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";

export namespace listSerapacksFx {
	export interface Props {
		storage?: SerapackStorage;
	}
}

/** Lists validated package descriptors without loading installed resource bodies. */
export const listSerapacksFx = Effect.fn("listSerapacksFx")(function* (
	props: listSerapacksFx.Props = {},
) {
	const storage = props.storage ?? (yield* createElectronSerapackStorageFx());
	const files = yield* storage.listFx;
	const grouped = new Map<string, SerapackStorage.Candidate[]>();
	for (const file of files) {
		const candidates = grouped.get(file.packageId) ?? [];
		candidates.push(file);
		grouped.set(file.packageId, candidates);
	}
	return yield* Effect.forEach(grouped.values(), (candidates) =>
		Effect.gen(function* () {
			const ordered = [
				...candidates,
			].sort((left, right) => compareSerapackSourcesFn(left.source, right.source));
			for (const file of ordered) {
				const descriptor = yield* Effect.sync(() => {
					try {
						return {
							packageId: file.packageId,
							contentHash: file.contentHash,
							title: file.title,
							version: GameVersionSchema.parse(file.version),
							serakki: SerakkiVersionSchema.parse(file.serakki),
							projectRevision: file.projectRevision,
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
