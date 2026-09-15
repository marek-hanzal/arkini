import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Effect } from "effect";

import { verifyArkpackFileProvenanceFx } from "~/arkpack-artifact/fx/verifyArkpackFileProvenanceFx";
import { readArkpackFileConfigFx } from "~/arkpack-artifact/fx/readArkpackFileConfigFx";
import { readArkpackFileLayoutFx } from "~/arkpack-artifact/fx/readArkpackFileLayoutFx";
import { createArkpackSourceProvenanceFn } from "~/arkpack-admission/fn/createArkpackSourceProvenanceFn";
import type { ExtractedArkpack } from "~/arkpack-admission/type/ExtractedArkpack";
import { validatePngResourceFileFx } from "~/game-config-resource/fx/validatePngResourceFileFx";
import { validateGameConfigFx } from "~/game-config-validation/fx/validateGameConfigFx";
import { validateGameResourcesFn } from "~/game-config-validation/fn/validateGameResourcesFn";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";
import { GameValidationError } from "~/game-config-diagnostic/error/GameValidationError";

const copyRangeFx = Effect.fn("extractArkpackFileFx.copyRangeFx")(
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

export namespace extractArkpackFileFx {
	export interface Props {
		readonly arkpackPath: string;
		readonly expectedPackageId?: string;
		readonly outputRoot: string;
	}
}

/** Validates one Arkpack while copying each raw resource range directly to disk. */
export const extractArkpackFileFx = Effect.fn("extractArkpackFileFx")(function* ({
	arkpackPath,
	expectedPackageId,
	outputRoot,
}: extractArkpackFileFx.Props) {
	const layout = yield* readArkpackFileLayoutFx(arkpackPath);
	const config = yield* readArkpackFileConfigFx(layout);
	const packageId = config.meta.id;
	if (expectedPackageId !== undefined && expectedPackageId !== packageId)
		return yield* Effect.fail(
			new Error(
				`Arkpack was addressed as package ${expectedPackageId}, but its config declares ${packageId}.`,
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
		yield* copyRangeFx(arkpackPath, resource.offset, resource.length, path);
		if (resource.mime === "image/png") yield* validatePngResourceFileFx(path, resource.id);
		resources.push({
			id: resource.id,
			mime: resource.mime,
			path,
			size: resource.length,
		});
	}
	const currentLayout = yield* readArkpackFileLayoutFx(arkpackPath);
	if (currentLayout.contentHash !== layout.contentHash || currentLayout.size !== layout.size)
		return yield* Effect.fail(new Error("The Arkpack changed while it was being extracted."));
	const sourceProvenance = createArkpackSourceProvenanceFn(packageId, config.items);
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
		arkini: layout.manifest.arkini,
		config,
		contentHash: layout.contentHash,
		packageId,
		provenance: yield* verifyArkpackFileProvenanceFx(currentLayout),
		resources,
		version: layout.manifest.version,
	} satisfies ExtractedArkpack;
});
