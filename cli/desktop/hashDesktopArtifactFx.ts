import { FileSystem } from "@effect/platform";
import { createHash } from "node:crypto";
import { Effect, Stream } from "effect";

export namespace hashDesktopArtifactFx {
	export interface Props {
		readonly path: string;
	}
}

export const hashDesktopArtifactFx = Effect.fn("hashDesktopArtifactFx")(function* ({
	path,
}: hashDesktopArtifactFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const hash = createHash("sha256");

	yield* fileSystem
		.stream(path, {
			chunkSize: 1024 * 1024,
		})
		.pipe(
			Stream.runForEach((chunk) =>
				Effect.sync(() => {
					hash.update(chunk);
				}),
			),
		);

	return hash.digest("hex");
});
