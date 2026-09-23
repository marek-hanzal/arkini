import { FileSystem } from "effect";
import { Effect, Semaphore } from "effect";
import { dirname, join } from "node:path";
import type { SerakkiElectronApi } from "~electron/contract/SerakkiElectronApi";
import { SerapackLimits } from "~shared/SerapackLimits";
import { ElectronMainError } from "../ElectronMainError";
import { readSerapackArtifactNameFn } from "~/serapack-artifact/fn/readSerapackArtifactNameFn";
import { listSerapackFilesFx } from "./listSerapackFilesFx";
import { readSerapackFileFx } from "./readSerapackFileFx";
import { withSerapackFileLockFx } from "./withSerapackFileLockFx";
import { removeUserSerapackFx } from "./removeUserSerapackFx";
import { installSerapackFileFx } from "./installSerapackFileFx";
import { importUserSerapackFx } from "./importUserSerapackFx";

interface SerapackCatalog {
	readonly listFx: Effect.Effect<
		ReadonlyArray<SerakkiElectronApi.SerapackFile>,
		ElectronMainError,
		never
	>;
	readonly readFx: (
		packageId: string,
	) => Effect.Effect<
		ReadonlyArray<SerakkiElectronApi.SerapackLoadedFile>,
		ElectronMainError,
		never
	>;
	readonly importFx: (
		sourcePath: string,
	) => Effect.Effect<SerakkiElectronApi.SerapackFile, ElectronMainError, never>;
	readonly removeFx: (packageId: string) => Effect.Effect<void, ElectronMainError, never>;
}

export namespace createFilesystemSerapackCatalogFx {
	export interface Props {
		readonly bundledRoot: string;
		readonly installationsRoot?: string;
		readonly maxCatalogBytes?: number;
		readonly maxCatalogCandidates?: number;
		readonly userRoot: string;
		readonly fileSystem?: FileSystem.FileSystem;
		readonly verifyProvenanceFx?: readSerapackFileFx.Props["verifyProvenanceFx"];
	}
}

/** Creates one user-preferred catalog over the two well-known package roots. */
export const createFilesystemSerapackCatalogFx = Effect.fn("createFilesystemSerapackCatalogFx")(
	function* ({
		bundledRoot,
		installationsRoot: requestedInstallationsRoot,
		maxCatalogBytes = SerapackLimits.maxCatalogBytes,
		maxCatalogCandidates = SerapackLimits.maxCatalogCandidates,
		userRoot,
		fileSystem: providedFileSystem,
		verifyProvenanceFx,
	}: createFilesystemSerapackCatalogFx.Props) {
		const installationsRoot =
			requestedInstallationsRoot ?? join(dirname(userRoot), "installed");
		const fileSystem = providedFileSystem ?? (yield* FileSystem.FileSystem);
		const operations = yield* Semaphore.make(1);
		const rootBudget = maxCatalogBytes / 2;
		const rootCandidateLimit = maxCatalogCandidates / 2;
		const scanFx = Effect.all(
			{
				bundled: listSerapackFilesFx({
					root: bundledRoot,
					fileSystem,
					maxCandidates: rootCandidateLimit,
					maxTotalBytes: rootBudget,
					source: "bundled",
					verifyProvenanceFx,
				}),
				user: listSerapackFilesFx({
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
		const publishScanFn = ({
			bundled,
			user,
		}: {
			readonly bundled: ReadonlyArray<SerakkiElectronApi.SerapackFile>;
			readonly user: ReadonlyArray<SerakkiElectronApi.SerapackFile>;
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
					return publishScanFn({
						bundled,
						user,
					});
				}),
			),
		);
		const readCandidateFx = (root: string, packageId: string, source: "bundled" | "user") => {
			const readFx = (candidateRoot: string) =>
				Effect.gen(function* () {
					const file = yield* readSerapackFileFx({
						root: candidateRoot,
						fileSystem,
						packageId,
						source,
						verifyProvenanceFx,
					});
					if (file === null) return null;
					const installed = yield* installSerapackFileFx({
						serapackPath: join(candidateRoot, file.filename),
						expectedPackageId: packageId,
						installationsRoot,
					});
					return {
						...file,
						provenance: installed.provenance,
						config: installed.config,
						resources: installed.resources.map((resource) => ({
							uid: resource.uid,
							type: resource.type,
							url: `serakki://app/game/resource?packageId=${encodeURIComponent(JSON.stringify(packageId))}&contentHash=${installed.contentHash}&resourceUid=${encodeURIComponent(JSON.stringify(resource.uid))}`,
						})),
					} satisfies SerakkiElectronApi.SerapackLoadedFile;
				});
			const candidate =
				source === "user"
					? withSerapackFileLockFx(
							{
								serapackPath: join(root, readSerapackArtifactNameFn(packageId)),
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
		const readFx: SerapackCatalog["readFx"] = Effect.fn("FilesystemSerapackCatalog.readFx")(
			(packageId) =>
				operations.withPermits(1)(
					Effect.gen(function* () {
						if (eligibility === undefined) publishScanFn(yield* scanFx);
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
			importFx: Effect.fn("FilesystemSerapackCatalog.importFx")((sourcePath) =>
				operations.withPermits(1)(
					importUserSerapackFx({
						fileSystem,
						sourcePath,
						stagingRoot: installationsRoot,
						userRoot,
					}).pipe(
						Effect.mapError(
							(cause) =>
								new ElectronMainError({
									operation: "import user Serapack",
									cause,
								}),
						),
						Effect.tap(() => Effect.sync(() => (eligibility = undefined))),
					),
				),
			),
			removeFx: Effect.fn("FilesystemSerapackCatalog.removeFx")((packageId) =>
				operations.withPermits(1)(
					removeUserSerapackFx({
						root: userRoot,
						fileSystem,
						packageId,
					}).pipe(Effect.tap(() => Effect.sync(() => (eligibility = undefined)))),
				),
			),
		} satisfies SerapackCatalog;
	},
);
