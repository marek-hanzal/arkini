import * as NodeServices from "@effect/platform-node/NodeServices";
import { FileSystem, Path } from "effect";
import { Effect } from "effect";
import { describe, expect, it } from "@effect/vitest";

import { ArkiniAppVersion } from "../../../shared/ArkiniAppMetadata";
import { readGameProjectManifestFx } from "~/game-config-source/fx/readGameProjectManifestFx";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";

const writerMajor = ArkiniAppVersion.slice(0, ArkiniAppVersion.indexOf("."));

describe("readGameProjectManifestFx", () => {
	it.effect("admits older and newer same-major portable writer versions", () =>
		Effect.gen(function* () {
			const fileSystem = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const root = yield* fileSystem.makeTempDirectoryScoped();
			const manifest = path.join(root, "project.json");
			for (const arkini of [
				`${writerMajor}.0.0`,
				`${writerMajor}.999.999`,
			]) {
				yield* fileSystem.writeFileString(
					manifest,
					JSON.stringify({
						arkini,
						revision: 1,
					}),
				);
				expect(yield* readGameProjectManifestFx(manifest)).toEqual([]);
			}
		}).pipe(Effect.provide(NodeServices.layer)),
	);

	it.effect("reports a different writer major at the Arkini field", () =>
		Effect.gen(function* () {
			const fileSystem = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const root = yield* fileSystem.makeTempDirectoryScoped();
			const manifest = path.join(root, "project.json");
			const arkini = `${Number(writerMajor) + 1}.0.0`;
			yield* fileSystem.writeFileString(
				manifest,
				JSON.stringify({
					arkini,
					revision: 1,
				}),
			);

			expect(yield* readGameProjectManifestFx(manifest)).toEqual([
				{
					code: DiagnosticCodeEnumSchema.enum.SourceSchemaInvalid,
					severity: DiagnosticSeverityEnumSchema.enum.Error,
					path: [
						"arkini",
					],
					source: manifest,
					message: `Editor project was written by Arkini ${arkini}; Arkini ${ArkiniAppVersion} only reads writer major ${writerMajor}.`,
					issueCode: "arkini-version-incompatible",
				},
			]);
		}).pipe(Effect.provide(NodeServices.layer)),
	);

	it.effect("keeps the portable manifest shape strict", () =>
		Effect.gen(function* () {
			const fileSystem = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const root = yield* fileSystem.makeTempDirectoryScoped();
			const manifest = path.join(root, "project.json");
			yield* fileSystem.writeFileString(
				manifest,
				JSON.stringify({
					arkini: ArkiniAppVersion,
					revision: 1,
					extra: true,
				}),
			);

			expect(yield* readGameProjectManifestFx(manifest)).toEqual([
				expect.objectContaining({
					code: DiagnosticCodeEnumSchema.enum.SourceSchemaInvalid,
					issueCode: "unrecognized_keys",
					source: manifest,
				}),
			]);
		}).pipe(Effect.provide(NodeServices.layer)),
	);
});
