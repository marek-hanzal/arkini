import { FileSystem } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const internalStoreImport = 'from "~/engine/runtime/internal/RuntimeStoreFx"';
const directRuntimeModify = "store.modifyEffect(";
const runtimeTransactionImport = 'from "~/engine/runtime/internal/modifyRuntimeFx"';
const revisionGuardImport = 'from "~/engine/revision/fx/assertRevisionFx"';
const allowedStoreImporters = new Set([
	"src/engine/game/layer/GameCoreLayerFx.ts",
	"src/engine/runtime/internal/makeRuntimeStoreFx.ts",
	"src/engine/runtime/internal/modifyRuntimeFx.ts",
]);
const allowedDirectModifiers = new Set([
	"src/engine/runtime/internal/modifyRuntimeFx.ts",
]);
const revisionFreeWriteFiles = new Set([
	"src/engine/job/write/clearItemJobQueueFx.ts",
	"src/engine/job/write/startLineFx.ts",
	"src/engine/placement/write/placeDropFx.ts",
	"src/engine/placement/write/placeOutputFx.ts",
	"src/engine/runtime/write/spawnItemFx.ts",
	"src/engine/start/write/startFx.ts",
	"src/engine/session/write/toggleSpeedModeFx.ts",
	"src/engine/space/write/setCurrentSpaceFx.ts",
	"src/engine/utility/write/requestNukeSaveFx.ts",
]);

const stateDerivedDecisionImports = [
	'from "~/engine/input/schema/run/InputRunPlanSchema"',
	'from "~/engine/line/schema/run/LineRunPlanSchema"',
	'from "~/engine/output/schema/DropResultSchema"',
	'from "~/engine/output/schema/OutputResultSchema"',
	'from "~/engine/placement/schema/PlacementPlanSchema"',
];

const collectTypeScriptFilesFx = (
	directory: string,
): Effect.Effect<string[], Error, FileSystem.FileSystem> => {
	return Effect.gen(function* () {
		const fileSystem = yield* FileSystem.FileSystem;
		const entries = yield* fileSystem.readDirectory(directory);
		const files = yield* Effect.forEach(entries, (entry) => {
			const path = `${directory}/${entry}`;

			return fileSystem.stat(path).pipe(
				Effect.flatMap((stat) => {
					if (stat.type === "Directory") {
						return collectTypeScriptFilesFx(path);
					}

					return Effect.succeed(
						path.endsWith(".ts")
							? [
									path,
								]
							: [],
					);
				}),
			);
		});

		return files.flat();
	});
};

const findImportersFx = ({ files, needle }: { files: string[]; needle: string }) => {
	return Effect.gen(function* () {
		const fileSystem = yield* FileSystem.FileSystem;

		return yield* Effect.filter(files, (file) => {
			return fileSystem
				.readFileString(file)
				.pipe(Effect.map((source) => source.includes(needle)));
		});
	});
};

describe("runtime mutation boundary", () => {
	it("keeps the mutable runtime store behind one transaction helper", async () => {
		const invalid = await Effect.runPromise(
			Effect.gen(function* () {
				const fileSystem = yield* FileSystem.FileSystem;
				const files = yield* collectTypeScriptFilesFx("src/engine");
				const storeImporters = yield* findImportersFx({
					files,
					needle: internalStoreImport,
				});
				const directModifiers = yield* findImportersFx({
					files: storeImporters,
					needle: directRuntimeModify,
				});
				const writeFiles = files.filter((file) => file.includes("/write/"));
				const writeWithoutTransactionBoundary = yield* Effect.filter(writeFiles, (file) => {
					return fileSystem
						.readFileString(file)
						.pipe(Effect.map((source) => !source.includes(runtimeTransactionImport)));
				});
				const writeWithoutRevisionGuard = (yield* Effect.filter(writeFiles, (file) => {
					return fileSystem
						.readFileString(file)
						.pipe(Effect.map((source) => !source.includes(revisionGuardImport)));
				})).filter((file) => !revisionFreeWriteFiles.has(file));
				const nestedWriteImports = yield* Effect.filter(writeFiles, (file) => {
					return fileSystem.readFileString(file).pipe(
						Effect.map((source) => {
							return /from "~\/engine\/[^"]+\/write\//.test(source);
						}),
					);
				});
				const staleDecisionImporters = (yield* Effect.forEach(
					stateDerivedDecisionImports,
					(needle) => {
						return findImportersFx({
							files: writeFiles,
							needle,
						}).pipe(
							Effect.map((importers) => {
								return importers.map((file) => ({
									file,
									needle,
								}));
							}),
						);
					},
				)).flat();

				return {
					directModifiers: directModifiers.filter(
						(file) => !allowedDirectModifiers.has(file),
					),
					staleDecisionImporters,
					nestedWriteImports,
					storeImporters: storeImporters.filter(
						(file) => !allowedStoreImporters.has(file),
					),
					writeWithoutRevisionGuard,
					writeWithoutTransactionBoundary,
				};
			}).pipe(Effect.provide(NodeContext.layer)),
		);

		expect(invalid).toEqual({
			directModifiers: [],
			staleDecisionImporters: [],
			nestedWriteImports: [],
			storeImporters: [],
			writeWithoutRevisionGuard: [],
			writeWithoutTransactionBoundary: [],
		});
	});
});
