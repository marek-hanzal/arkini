import { Effect } from "effect";

import { SerakkiVersionIncompatibleError } from "~/application-version/error/SerakkiVersionIncompatibleError";
import { SerakkiVersionSchema } from "~/application-version/schema/SerakkiVersionSchema";
import type { SerapackStorage } from "~/serapack-catalog/service/SerapackStorage";
import type { SerapackDescriptor } from "~/serapack-catalog/type/SerapackDescriptor";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";
import type { ResourceTypeSchema } from "~/game-config-resource/schema/ResourceTypeSchema";

export interface LoadedSerapackResource {
	readonly id: string;
	readonly type: ResourceTypeSchema.Type;
	readonly url: string;
}

export interface LoadedSerapack {
	readonly descriptor: SerapackDescriptor;
	readonly payload: {
		readonly version: GameVersionSchema.Type;
		readonly serakki: SerakkiVersionSchema.Type;
		readonly config: GameConfigSchema.Type;
		readonly resources: ReadonlyArray<LoadedSerapackResource>;
	};
}

/** Selects the first valid user-first installed candidate. */
export const readSerapackCandidatesFx = Effect.fn("readSerapackCandidatesFx")(function* (
	files: ReadonlyArray<SerapackStorage.LoadedFile>,
) {
	const candidates = [
		...files,
	].sort((left, right) => (left.source === right.source ? 0 : left.source === "user" ? -1 : 1));
	let incompatibility: SerakkiVersionIncompatibleError | undefined;
	for (const file of candidates) {
		const result = yield* Effect.result(
			Effect.try({
				try: (): LoadedSerapack => {
					const config = GameConfigSchema.parse(file.config);
					if (config.meta.id !== file.packageId)
						throw new Error(
							`Serapack was addressed as package ${file.packageId}, but its config declares ${config.meta.id}.`,
						);
					return {
						descriptor: {
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
						},
						payload: {
							version: GameVersionSchema.parse(file.version),
							serakki: SerakkiVersionSchema.parse(file.serakki),
							config,
							resources: file.resources,
						},
					};
				},
				catch: (cause) => cause,
			}),
		);
		if (result._tag === "Success") return result.success;
		if (result.failure instanceof SerakkiVersionIncompatibleError)
			incompatibility ??= result.failure;
	}
	if (incompatibility !== undefined) return yield* Effect.fail(incompatibility);
	return undefined;
});
