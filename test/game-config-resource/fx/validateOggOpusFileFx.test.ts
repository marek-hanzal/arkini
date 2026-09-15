import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, it } from "@effect/vitest";

import { validateOggOpusFileFx } from "~/game-config-resource/fx/validateOggOpusFileFx";
import { createTestOggOpusBytesFn } from "~test/game-config-resource/support/createTestOggOpusBytesFn";

describe("Ogg/Opus resource admission", () => {
	it.effect("requires complete bounded headers and an audio packet", () =>
		Effect.gen(function* () {
			const fileSystem = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const root = yield* fileSystem.makeTempDirectoryScoped();
			const opus = path.join(root, "theme.ogg");
			const vorbis = path.join(root, "legacy.ogg");
			const opusBytes = createTestOggOpusBytesFn();
			const incomplete = opusBytes.subarray(0, 47);
			const vorbisBytes = Buffer.from(opusBytes);
			vorbisBytes.write("\x01vorbis", 28, "binary");
			yield* fileSystem.writeFile(opus, opusBytes);
			yield* fileSystem.writeFile(vorbis, vorbisBytes);

			expect(yield* validateOggOpusFileFx(opus, "theme")).toBe(opusBytes.byteLength);
			const rejected = yield* Effect.flip(validateOggOpusFileFx(vorbis, "legacy"));
			expect(rejected.message).toContain("valid Ogg/Opus");
			yield* fileSystem.writeFile(vorbis, incomplete);
			const truncated = yield* Effect.flip(validateOggOpusFileFx(vorbis, "legacy"));
			expect(truncated.message).toContain("valid Ogg/Opus");
		}).pipe(Effect.provide(NodeServices.layer)),
	);
});
