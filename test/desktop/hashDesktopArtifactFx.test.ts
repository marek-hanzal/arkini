import { FileSystem } from "@effect/platform";
import { createHash } from "node:crypto";
import { Effect, Stream } from "effect";
import { describe, expect, it } from "vitest";
import { hashDesktopArtifactFx } from "../../cli/desktop/hashDesktopArtifactFx";

const textEncoder = new TextEncoder();

describe("hashDesktopArtifactFx", () => {
	it("hashes artifact chunks through the filesystem stream", async () => {
		const chunks = [
			textEncoder.encode("chunk-one:"),
			textEncoder.encode("chunk-two:"),
			textEncoder.encode("chunk-three"),
		];
		const fileSystem = FileSystem.makeNoop({
			readFile: () => Effect.die(new Error("readFile must not be used for artifact hashing")),
			stream: () => Stream.fromIterable(chunks),
		});
		const expected = createHash("sha256")
			.update(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))))
			.digest("hex");

		await expect(
			Effect.runPromise(
				hashDesktopArtifactFx({
					path: "fixture.dmg",
				}).pipe(Effect.provideService(FileSystem.FileSystem, fileSystem)),
			),
		).resolves.toBe(expected);
	});
});
