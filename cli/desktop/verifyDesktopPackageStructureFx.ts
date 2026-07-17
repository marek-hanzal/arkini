import { FileSystem } from "@effect/platform";
import { join } from "node:path";
import { Effect } from "effect";
import { DesktopMacArtifacts } from "./DesktopMacArtifacts";
import { DesktopPackagingError } from "./DesktopPackagingError";

export namespace verifyDesktopPackageStructureFx {
	export interface Props {
		readonly directory?: string;
	}
}

export const verifyDesktopPackageStructureFx = Effect.fn("verifyDesktopPackageStructureFx")(
	function* ({ directory = "release" }: verifyDesktopPackageStructureFx.Props = {}) {
		const verification = Effect.gen(function* () {
			const fileSystem = yield* FileSystem.FileSystem;

			for (const name of DesktopMacArtifacts.names) {
				const file = yield* fileSystem.stat(join(directory, name));
				if (file.type !== "File" || file.size === 0n) {
					return yield* Effect.fail(new Error(`Desktop artifact is empty: ${name}`));
				}
			}

			yield* fileSystem.access(
				join(directory, "mac-arm64", "Arkini.app", "Contents", "Resources", "app.asar"),
			);
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
