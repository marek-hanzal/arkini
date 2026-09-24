import { match } from "ts-pattern";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Effect } from "effect";

import { verifySerapackFileProvenanceFx } from "~/serapack-artifact/fx/verifySerapackFileProvenanceFx";
import { readSerapackFileConfigFx } from "~/serapack-artifact/fx/readSerapackFileConfigFx";
import { readSerapackFileLayoutFx } from "~/serapack-artifact/fx/readSerapackFileLayoutFx";
import { createSerapackSourceProvenanceFn } from "~/serapack-admission/fn/createSerapackSourceProvenanceFn";
import type { ExtractedSerapack } from "~/serapack-admission/type/ExtractedSerapack";
import { validatePngResourceFileFx } from "~/game-config-resource/fx/validatePngResourceFileFx";
import { validateArtworkPngFileFx } from "~/game-config-resource/fx/validateArtworkPngFileFx";
import { validateOggOpusFileFx } from "~/game-config-resource/fx/validateOggOpusFileFx";
import { validateGameConfigFx } from "~/game-config-validation/fx/validateGameConfigFx";
import { validateGameResourcesFn } from "~/game-config-validation/fn/validateGameResourcesFn";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";
import { GameValidationError } from "~/game-config-diagnostic/error/GameValidationError";

const copyRangeFx = Effect.fn("extractSerapackFileFx.copyRangeFx")(
	(source: string, offset: number, length: number, target: string) =>
		Effect.tryPromise({
			try: async () => {
				if (length === 0) {
					await writeFile(target, new Uint8Array());
					return;
				}
				await pipeline(
					createReadStream(source, {
						start: offset,
						end: offset + length - 1,
					}),
					createWriteStream(target, {
						flags: "wx",
					}),
				);
			},
			catch: (cause) => cause,
		}),
);

export namespace extractSerapackFileFx {
	export interface Props {
		readonly serapackPath: string;
		readonly expectedPackageId?: string;
		readonly outputRoot: string;
	}
}

/** Validates one Serapack while copying each raw resource range directly to disk. */
export const extractSerapackFileFx = Effect.fn("extractSerapackFileFx")(function* ({
	serapackPath,
	expectedPackageId,
	outputRoot,
}: extractSerapackFileFx.Props) {
	const layout = yield* readSerapackFileLayoutFx(serapackPath);
	const config = yield* readSerapackFileConfigFx(layout);
	const packageId = config.meta.id;
	if (expectedPackageId !== undefined && expectedPackageId !== packageId)
		return yield* Effect.fail(
			new Error(
				`Serapack was addressed as package ${expectedPackageId}, but its config declares ${packageId}.`,
			),
		);
	const resourcesRoot = join(outputRoot, "resources");
	yield* Effect.tryPromise({
		try: () =>
			mkdir(resourcesRoot, {
				recursive: true,
			}),
		catch: (cause) => cause,
	});
	const resources = [];
	for (let index = 0; index < layout.resources.length; index += 1) {
		const resource = layout.resources[index];
		const path = join(resourcesRoot, String(index).padStart(6, "0"));
		yield* copyRangeFx(serapackPath, resource.offset, resource.length, path);
		yield* match(resource.type)
			.with("artwork", () => validateArtworkPngFileFx(path, resource.uid))
			.with("image", () => validatePngResourceFileFx(path, resource.uid))
			.with("music", "sfx", () => validateOggOpusFileFx(path, resource.uid))
			.exhaustive();
		resources.push({
			uid: resource.uid,
			type: resource.type,
			path,
			size: resource.length,
		});
	}
	const sourceProvenance = createSerapackSourceProvenanceFn(packageId, config.items);
	const diagnostics = [
		...(yield* validateGameConfigFx({
			config,
			provenance: sourceProvenance,
		})),
		...validateGameResourcesFn({
			config,
			provenance: sourceProvenance,
			resources,
		}),
	];
	const errors = diagnostics.filter(
		({ severity }) => severity === DiagnosticSeverityEnumSchema.enum.Error,
	);
	if (errors.length > 0)
		return yield* Effect.fail(
			new GameValidationError({
				diagnostics: errors,
			}),
		);
	return {
		serakki: layout.manifest.serakki,
		config,
		contentHash: layout.contentHash,
		packageId,
		provenance: yield* verifySerapackFileProvenanceFx(layout),
		resources,
		version: layout.manifest.version,
		projectRevision: layout.manifest.projectRevision,
	} satisfies ExtractedSerapack;
});
