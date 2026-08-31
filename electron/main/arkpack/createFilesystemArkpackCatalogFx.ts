import { FileSystem } from "effect";
import { Effect, Semaphore } from "effect";
import { dirname, join } from "node:path";
import type { ArkiniElectronApi } from "~electron/contract/ArkiniElectronApi";
import { ArkpackLimits } from "~shared/ArkpackLimits";
import type { ElectronMainError } from "../ElectronMainError";
import { readArkpackArtifactNameFn } from "~/arkpack-artifact/fn/readArkpackArtifactNameFn";
import { listArkpackFilesFx } from "./listArkpackFilesFx";
import { readArkpackFileFx } from "./readArkpackFileFx";
import { withArkpackFileLockFx } from "./withArkpackFileLockFx";
import { removeUserArkpackFx } from "./removeUserArkpackFx";
import { writeUserArkpackFx } from "./writeUserArkpackFx";

interface ArkpackCatalog {
	readonly listFx: Effect.Effect<ReadonlyArray<ArkiniElectronApi.ArkpackFile>, ElectronMainError>;
	readonly readFx: (
		packageId: string,
	) => Effect.Effect<ReadonlyArray<ArkiniElectronApi.ArkpackFile>, ElectronMainError>;
	readonly installFx: (
		record: ArkiniElectronApi.ArkpackInstall,
	) => Effect.Effect<void, ElectronMainError>;
	readonly removeFx: (packageId: string) => Effect.Effect<void, ElectronMainError>;
}

export namespace createFilesystemArkpackCatalogFx {
	export interface Props {
		readonly bundledRoot: string;
		readonly maxCatalogBytes?: number;
		readonly maxCatalogCandidates?: number;
		readonly userRoot: string;
		readonly fileSystem?: FileSystem.FileSystem;
		readonly verifyProvenanceFx?: readArkpackFileFx.Props["verifyProvenanceFx"];
	}
}

/** Creates one user-preferred catalog over the two well-known package roots. */
export const createFilesystemArkpackCatalogFx = Effect.fn("createFilesystemArkpackCatalogFx")(
	function* ({
		bundledRoot,
		maxCatalogBytes = ArkpackLimits.maxCatalogBytes,
		maxCatalogCandidates = ArkpackLimits.maxCatalogCandidates,
		userRoot,
		fileSystem: providedFileSystem,
		verifyProvenanceFx,
	}: createFilesystemArkpackCatalogFx.Props) {
		const fileSystem = providedFileSystem ?? (yield* FileSystem.FileSystem);
		const operations = yield* Semaphore.make(1);
		const rootBudget = maxCatalogBytes / 2;
		const rootCandidateLimit = maxCatalogCandidates / 2;
		const scanFx = Effect.all(
			{
				bundled: listArkpackFilesFx({
					root: bundledRoot,
					fileSystem,
					maxCandidates: rootCandidateLimit,
					maxTotalBytes: rootBudget,
					source: "bundled",
					verifyProvenanceFx,
				}),
				user: listArkpackFilesFx({
					root: userRoot,
					fileSystem,
					maxCandidates: rootCandidateLimit,
					maxTotalBytes: rootBudget,
					source: "user",
					verifyProvenanceFx,
				}),
			},
			{
				concurrency: "unbounded",
			},
		);
		let eligibility:
			| {
					readonly bundled: ReadonlySet<string>;
					readonly user: ReadonlySet<string>;
			  }
			| undefined;
		const publishScan = ({
			bundled,
			user,
		}: {
			readonly bundled: ReadonlyArray<ArkiniElectronApi.ArkpackFile>;
			readonly user: ReadonlyArray<ArkiniElectronApi.ArkpackFile>;
		}) => {
			const bundledIds = new Set(bundled.map(({ packageId }) => packageId));
			eligibility = {
				bundled: bundledIds,
				user: new Set(user.map(({ packageId }) => packageId)),
			};
			return [
				...bundled,
				...user.map((file) => ({
					...file,
					overridesBundled: bundledIds.has(file.packageId),
				})),
			];
		};
		const listFx = operations.withPermits(1)(
			scanFx.pipe(
				Effect.map(({ bundled, user }) => {
					return publishScan({
						bundled,
						user,
					});
				}),
			),
		);
		const readCandidateFx = (root: string, packageId: string, source: "bundled" | "user") => {
			const readFx = (candidateRoot: string) =>
				readArkpackFileFx({
					root: candidateRoot,
					fileSystem,
					packageId,
					source,
					verifyProvenanceFx,
				});
			const candidate =
				source === "user"
					? withArkpackFileLockFx(
							{
								arkpackPath: join(root, readArkpackArtifactNameFn(packageId)),
								fileSystem,
							},
							(path) => readFx(dirname(path)),
						)
					: readFx(root);
			return candidate.pipe(
				Effect.match({
					onFailure: () => null,
					onSuccess: (file) => file,
				}),
			);
		};
		const readFx: ArkpackCatalog["readFx"] = Effect.fn("FilesystemArkpackCatalog.readFx")(
			(packageId) =>
				operations.withPermits(1)(
					Effect.gen(function* () {
						if (eligibility === undefined) publishScan(yield* scanFx);
						const eligible = eligibility;
						if (eligible === undefined) return [];
						const [bundled, user] = yield* Effect.all(
							[
								eligible.bundled.has(packageId)
									? readCandidateFx(bundledRoot, packageId, "bundled")
									: Effect.succeed(null),
								eligible.user.has(packageId)
									? readCandidateFx(userRoot, packageId, "user")
									: Effect.succeed(null),
							],
							{
								concurrency: "unbounded",
							},
						);
						return [
							...(bundled === null
								? []
								: [
										bundled,
									]),
							...(user === null
								? []
								: [
										{
											...user,
											overridesBundled: bundled !== null,
										},
									]),
						];
					}),
				),
		);
		return {
			listFx,
			readFx,
			installFx: Effect.fn("FilesystemArkpackCatalog.installFx")((record) =>
				operations.withPermits(1)(
					writeUserArkpackFx({
						root: userRoot,
						fileSystem,
						record,
					}).pipe(Effect.tap(() => Effect.sync(() => (eligibility = undefined)))),
				),
			),
			removeFx: Effect.fn("FilesystemArkpackCatalog.removeFx")((packageId) =>
				operations.withPermits(1)(
					removeUserArkpackFx({
						root: userRoot,
						fileSystem,
						packageId,
					}).pipe(Effect.tap(() => Effect.sync(() => (eligibility = undefined)))),
				),
			),
		} satisfies ArkpackCatalog;
	},
);
