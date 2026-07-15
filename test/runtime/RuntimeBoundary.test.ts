import { FileSystem } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const internalStoreImport = 'from "~/v1/runtime/internal/RuntimeStoreFx"';
const directRuntimeModify = "store.modifyEffect(";
const runtimeTransactionImport = 'from "~/v1/runtime/internal/modifyRuntimeFx"';
const revisionGuardImport = 'from "~/v1/revision/fx/assertRevisionFx"';
const allowedStoreImporters = new Set([
	"src/v1/game/layer/GameCoreLayerFx.ts",
	"src/v1/runtime/internal/makeRuntimeStoreFx.ts",
	"src/v1/runtime/internal/modifyRuntimeFx.ts",
]);
const allowedDirectModifiers = new Set([
	"src/v1/runtime/internal/modifyRuntimeFx.ts",
]);
const revisionFreeWriteFiles = new Set([
	"src/v1/job/write/clearItemJobQueueFx.ts",
	"src/v1/job/write/startLineFx.ts",
	"src/v1/placement/write/placeDropFx.ts",
	"src/v1/placement/write/placeOutputFx.ts",
	"src/v1/runtime/write/spawnItemFx.ts",
	"src/v1/start/write/startFx.ts",
]);

const stateDerivedDecisionImports = [
	'from "~/v1/input/schema/run/InputRunPlanSchema"',
	'from "~/v1/line/schema/run/LineRunPlanSchema"',
	'from "~/v1/output/schema/DropResultSchema"',
	'from "~/v1/output/schema/OutputResultSchema"',
	'from "~/v1/placement/schema/PlacementPlanSchema"',
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
				const files = yield* collectTypeScriptFilesFx("src/v1");
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
							return /from "~\/v1\/[^"]+\/write\//.test(source);
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
