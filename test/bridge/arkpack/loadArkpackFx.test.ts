import { Effect } from "effect";
import { beforeEach, describe, expect, it } from "vitest";

import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { loadArkpackFx } from "~/bridge/arkpack/loadArkpackFx";
import { createTestArkpack } from "~test/bridge/arkpack/support/createTestArkpack";
import { installTestPngDecoder } from "~test/bridge/arkpack/support/createTestPngBytes";

beforeEach(installTestPngDecoder);

describe("loadArkpackFx", () => {
	it("loads the exact effective file selected by package identity", async () => {
		const bytes = createTestArkpack(undefined, "package:selected");
		const file: ArkpackStorage.File = {
			packageId: "package:selected",
			filename: "package%3Aselected.game.arkpack",
			bytes: bytes.buffer,
			source: "user",
			overridesBundled: true,
		};
		const storage: ArkpackStorage = {
			listFx: Effect.die("Unexpected catalog list."),
			readFx: (packageId) =>
				Effect.succeed(
					packageId === file.packageId
						? [
								file,
							]
						: [],
				),
			removeFx: () => Effect.void,
			writeFx: () => Effect.void,
			openUserDirectoryFx: Effect.void,
		};

		const loaded = await Effect.runPromise(
			loadArkpackFx({
				packageId: "package:selected",
				storage,
			}),
		);

		expect(loaded.descriptor).toMatchObject({
			packageId: "package:selected",
			gameId: "game:bridge",
			source: "user",
			overridesBundled: true,
		});
		expect(loaded.payload.packageId).toBe("package:selected");
	});

	it("fails when the requested package is absent", async () => {
		const storage: ArkpackStorage = {
			listFx: Effect.die("Unexpected catalog list."),
			readFx: () => Effect.succeed([]),
			removeFx: () => Effect.void,
			writeFx: () => Effect.void,
			openUserDirectoryFx: Effect.void,
		};

		await expect(
			Effect.runPromise(
				loadArkpackFx({
					packageId: "missing",
					storage,
				}),
			),
		).rejects.toThrow("Arkpack missing is not installed");
	});

	it("refuses to start a package with an invalid detached signature", async () => {
		const bundledBytes = createTestArkpack(undefined, "package:tampered");
		const userBytes = createTestArkpack(undefined, "package:tampered");
		const storage: ArkpackStorage = {
			listFx: Effect.die("Unexpected catalog list."),
			readFx: () =>
				Effect.succeed([
					{
						packageId: "package:tampered",
						filename: "package%3Atampered.game.arkpack",
						bytes: bundledBytes.buffer,
						source: "bundled",
						overridesBundled: false,
					},
					{
						packageId: "package:tampered",
						filename: "package%3Atampered.game.arkpack",
						bytes: userBytes.buffer,
						signature: {
							malformed: true,
						},
						source: "user",
						overridesBundled: true,
					},
				]),
			removeFx: () => Effect.void,
			writeFx: () => Effect.void,
			openUserDirectoryFx: Effect.void,
		};

		await expect(
			Effect.runPromise(
				loadArkpackFx({
					packageId: "package:tampered",
					storage,
				}),
			),
		).rejects.toThrow("invalid detached signature");
	});
});
