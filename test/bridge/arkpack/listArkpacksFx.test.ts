import { Effect } from "effect";
import { beforeEach, describe, expect, it } from "vitest";

import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { listArkpacksFx } from "~/bridge/arkpack/listArkpacksFx";
import { createTestArkpack } from "~test/bridge/arkpack/support/createTestArkpack";
import { installTestPngDecoder } from "~test/bridge/arkpack/support/createTestPngBytes";

beforeEach(installTestPngDecoder);

describe("listArkpacksFx", () => {
	it("derives descriptors from the effective raw files", async () => {
		const bytes = createTestArkpack(undefined, "package:catalog");
		const storage: ArkpackStorage = {
			listFx: Effect.succeed([
				{
					packageId: "package:catalog",
					filename: "package%3Acatalog.arkpack",
					bytes: bytes.buffer,
					source: "user",
					overridesBundled: true,
				},
			]),
			readFx: () => Effect.die("Unexpected exact read."),
			removeFx: () => Effect.void,
			writeFx: () => Effect.void,
			openUserDirectoryFx: Effect.void,
		};

		await expect(
			Effect.runPromise(
				listArkpacksFx({
					storage,
				}),
			),
		).resolves.toEqual([
			expect.objectContaining({
				packageId: "package:catalog",
				source: "user",
				overridesBundled: true,
			}),
		]);
	});

	it("falls back to bundled when a user candidate fails payload validation", async () => {
		const bundledBytes = createTestArkpack(undefined, "package:filename");
		const userBytes = createTestArkpack(undefined, "package:payload");
		const storage: ArkpackStorage = {
			listFx: Effect.succeed([
				{
					packageId: "package:filename",
					filename: "package%3Afilename.arkpack",
					bytes: bundledBytes.buffer,
					source: "bundled",
					overridesBundled: false,
				},
				{
					packageId: "package:filename",
					filename: "package%3Afilename.arkpack",
					bytes: userBytes.buffer,
					source: "user",
					overridesBundled: true,
				},
			]),
			readFx: () => Effect.die("Unexpected exact read."),
			removeFx: () => Effect.void,
			writeFx: () => Effect.void,
			openUserDirectoryFx: Effect.void,
		};

		await expect(
			Effect.runPromise(
				listArkpacksFx({
					storage,
				}),
			),
		).resolves.toEqual([
			expect.objectContaining({
				packageId: "package:filename",
				source: "bundled",
			}),
		]);
	});
});
