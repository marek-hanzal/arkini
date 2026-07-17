import { FileSystem } from "@effect/platform";
import { basename, join } from "node:path";
import { Effect } from "effect";
import { DesktopMacArtifacts } from "./DesktopMacArtifacts";
import { DesktopPackagingError } from "./DesktopPackagingError";
import { hashDesktopArtifactFx } from "./hashDesktopArtifactFx";

export namespace createDesktopChecksumsFx {
	export interface Props {
		readonly directory?: string;
	}
}

export const createDesktopChecksumsFx = Effect.fn("createDesktopChecksumsFx")(function* ({
	directory = "release",
}: createDesktopChecksumsFx.Props = {}) {
	const creation = Effect.gen(function* () {
		const fileSystem = yield* FileSystem.FileSystem;
		const lines = yield* Effect.forEach(
			DesktopMacArtifacts.names,
			(name) =>
				Effect.gen(function* () {
					const path = join(directory, name);
					const file = yield* fileSystem.stat(path);
					if (file.type !== "File" || file.size === 0n) {
						return yield* Effect.fail(new Error(`Desktop artifact is empty: ${name}`));
					}
					const hash = yield* hashDesktopArtifactFx({
						path,
					});
					return `${hash}  ${basename(name)}`;
				}),
			{
				concurrency: 1,
			},
		);

		yield* fileSystem.writeFileString(join(directory, "SHA256SUMS"), `${lines.join("\n")}\n`);
	});

	return yield* creation.pipe(
		Effect.mapError(
			(cause) =>
				new DesktopPackagingError({
					operation: "create desktop artifact checksums",
					cause,
				}),
		),
	);
});
