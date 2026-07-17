import { FileSystem } from "@effect/platform";
import { join } from "node:path";
import { Effect } from "effect";
import { DesktopMacArtifacts } from "./DesktopMacArtifacts";
import { DesktopPackagingError } from "./DesktopPackagingError";
import { hashDesktopArtifactFx } from "./hashDesktopArtifactFx";
import { verifyDesktopPackageStructureFx } from "./verifyDesktopPackageStructureFx";

export namespace verifyDesktopArtifactsFx {
	export interface Props {
		readonly directory?: string;
	}
}

export const verifyDesktopArtifactsFx = Effect.fn("verifyDesktopArtifactsFx")(function* ({
	directory = "release",
}: verifyDesktopArtifactsFx.Props = {}) {
	const verification = Effect.gen(function* () {
		const fileSystem = yield* FileSystem.FileSystem;
		const checksumLines = (yield* fileSystem.readFileString(join(directory, "SHA256SUMS")))
			.trim()
			.split("\n")
			.filter(Boolean);
		const expectedNames = new Set<DesktopMacArtifacts.Name>(DesktopMacArtifacts.names);

		if (checksumLines.length !== expectedNames.size) {
			return yield* Effect.fail(
				new Error("SHA256SUMS must contain exactly the macOS DMG and ZIP artifacts."),
			);
		}

		for (const line of checksumLines) {
			const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
			if (!match) return yield* Effect.fail(new Error(`Invalid SHA256SUMS line: ${line}`));
			const [, expectedHash, name] = match;
			if (!expectedNames.delete(name as DesktopMacArtifacts.Name)) {
				return yield* Effect.fail(
					new Error(`Unexpected or duplicate desktop artifact: ${name}`),
				);
			}
			const actualHash = yield* hashDesktopArtifactFx({
				path: join(directory, name),
			});
			if (actualHash !== expectedHash) {
				return yield* Effect.fail(new Error(`Checksum mismatch for ${name}`));
			}
		}

		if (expectedNames.size > 0) {
			return yield* Effect.fail(
				new Error(
					`Missing desktop artifact checksums: ${[
						...expectedNames,
					].join(", ")}`,
				),
			);
		}

		yield* verifyDesktopPackageStructureFx({
			directory,
		}).pipe(Effect.mapError((error) => error.cause));
	});

	return yield* verification.pipe(
		Effect.mapError(
			(cause) =>
				new DesktopPackagingError({
					operation: "verify desktop artifacts",
					cause,
				}),
		),
	);
});
