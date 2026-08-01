import { listPackage } from "@electron/asar";
import { FileSystem } from "effect";
import { join } from "node:path";
import { Effect } from "effect";
import { ProjectOutputPaths } from "../../shared/ProjectOutputPaths";
import { DesktopMacArtifacts } from "./DesktopMacArtifacts";
import { DesktopPackagingError } from "./DesktopPackagingError";

const MaxDesktopAsarBytes = 25n * 1024n * 1024n;

export namespace verifyDesktopPackageStructureFx {
	export interface Props {
		readonly directory?: string;
	}
}

export const verifyDesktopPackageStructureFx = Effect.fn("verifyDesktopPackageStructureFx")(
	function* ({
		directory = ProjectOutputPaths.desktop.release,
	}: verifyDesktopPackageStructureFx.Props = {}) {
		const verification = Effect.gen(function* () {
			const fileSystem = yield* FileSystem.FileSystem;

			for (const name of DesktopMacArtifacts.names) {
				const file = yield* fileSystem.stat(join(directory, name));
				if (file.type !== "File" || file.size === 0n) {
					return yield* Effect.fail(new Error(`Desktop artifact is empty: ${name}`));
				}
			}

			const asarPath = join(
				directory,
				"mac-arm64",
				"Arkini.app",
				"Contents",
				"Resources",
				"app.asar",
			);
			const asarFile = yield* fileSystem.stat(asarPath);
			if (asarFile.type !== "File" || asarFile.size === 0n) {
				return yield* Effect.fail(new Error("Packaged app.asar is empty."));
			}
			if (asarFile.size > MaxDesktopAsarBytes) {
				return yield* Effect.fail(
					new Error(`Packaged app.asar exceeds 25 MiB: ${asarFile.size} bytes.`),
				);
			}

			const packagedPaths = yield* Effect.try({
				try: () =>
					listPackage(asarPath, {
						isPack: false,
					}),
				catch: (cause) => cause,
			});
			if (
				packagedPaths.some(
					(path) => path === "/node_modules" || path.startsWith("/node_modules/"),
				)
			) {
				return yield* Effect.fail(new Error("Packaged app.asar contains node_modules."));
			}
		});

		return yield* verification.pipe(
			Effect.mapError(
				(cause) =>
					new DesktopPackagingError({
						operation: "verify packaged desktop structure",
						cause,
					}),
			),
		);
	},
);
