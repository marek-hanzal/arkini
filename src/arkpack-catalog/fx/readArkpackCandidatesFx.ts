import { Effect } from "effect";

import type { ArkpackStorage } from "~/arkpack-catalog/service/ArkpackStorage";
import { readArkpackFx } from "~/arkpack-admission/fx/readArkpackFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { ArkiniVersionSchema } from "~/application-version/schema/ArkiniVersionSchema";
import { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";
import { ArkiniVersionIncompatibleError } from "~/application-version/error/ArkiniVersionIncompatibleError";
import type { ArkpackDescriptor } from "~/arkpack-catalog/type/ArkpackDescriptor";
import type { ResourceSchema } from "~/game-config-resource/schema/ResourceSchema";

export type LoadedArkpackResource =
	| ResourceSchema.Type
	| {
			readonly id: string;
			readonly mime: string;
			readonly url: string;
	  };

export interface LoadedArkpack {
	readonly descriptor: ArkpackDescriptor;
	readonly payload: {
		readonly version: GameVersionSchema.Type;
		readonly arkini: ArkiniVersionSchema.Type;
		readonly config: GameConfigSchema.Type;
		readonly resources: ReadonlyArray<LoadedArkpackResource>;
	};
}

/** Selects the first valid user-first candidate while Electron stays filesystem-backed. */
export const readArkpackCandidatesFx = Effect.fn("readArkpackCandidatesFx")(function* (
	files: ReadonlyArray<ArkpackStorage.LoadedFile>,
) {
	const candidates = [
		...files,
	].sort((left, right) => (left.source === right.source ? 0 : left.source === "user" ? -1 : 1));
	let incompatibility: ArkiniVersionIncompatibleError | undefined;
	for (const file of candidates) {
		const loadCandidateFx: Effect.Effect<LoadedArkpack, unknown, never> =
			"bytes" in file
				? readArkpackFx({
						bytes: new Uint8Array(file.bytes),
						filename: file.filename,
						packageId: file.packageId,
						provenance: file.provenance,
						source: file.source,
						overridesBundled: file.overridesBundled,
					}).pipe(
						Effect.map(
							(loaded) =>
								({
									descriptor: {
										...loaded.descriptor,
										filename: loaded.descriptor.filename ?? file.filename,
									},
									payload: loaded.payload,
								}) satisfies LoadedArkpack,
						),
					)
				: "config" in file
					? Effect.try({
							try: () => {
								const config = GameConfigSchema.parse(file.config);
								if (config.meta.id !== file.packageId)
									throw new Error(
										`Arkpack was addressed as package ${file.packageId}, but its config declares ${config.meta.id}.`,
									);
								return {
									descriptor: {
										packageId: file.packageId,
										contentHash: file.contentHash,
										title: file.title,
										version: GameVersionSchema.parse(file.version),
										arkini: ArkiniVersionSchema.parse(file.arkini),
										provenance: file.provenance,
										source: file.source,
										overridesBundled: file.overridesBundled,
										filename: file.filename,
									},
									payload: {
										version: GameVersionSchema.parse(file.version),
										arkini: ArkiniVersionSchema.parse(file.arkini),
										config,
										resources: file.resources,
									},
								} satisfies LoadedArkpack;
							},
							catch: (cause) => cause,
						})
					: Effect.fail(new Error("Arkpack installation metadata is incomplete."));
		const result = yield* Effect.result(loadCandidateFx);
		if (result._tag === "Success") return result.success;
		if (result.failure instanceof ArkiniVersionIncompatibleError)
			incompatibility ??= result.failure;
	}
	if (incompatibility !== undefined) return yield* Effect.fail(incompatibility);
	return undefined;
});
