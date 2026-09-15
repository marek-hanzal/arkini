import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { importArkpackFileFx } from "~/arkpack-catalog/fx/importArkpackFileFx";
import type { ArkpackStorage } from "~/arkpack-catalog/service/ArkpackStorage";

describe("importArkpackFileFx", () => {
	it("delegates native selection and streamed import to storage", async () => {
		const imported: ArkpackStorage.FilesystemFile = {
			packageId: "package:test",
			filename: "package%3Atest.arkpack",
			contentHash: "a".repeat(64),
			title: "Test",
			version: "1.0",
			arkini: "0.5.0",
			provenance: {
				type: "community",
			},
			source: "user",
			overridesBundled: false,
		};
		const storage = {
			listFx: Effect.succeed([]),
			readFx: () => Effect.succeed([]),
			removeFx: () => Effect.void,
			writeFx: () => Effect.void,
			importFx: Effect.succeed(imported),
			openUserDirectoryFx: Effect.void,
		} satisfies ArkpackStorage;

		await expect(
			Effect.runPromise(
				importArkpackFileFx({
					storage,
				}),
			),
		).resolves.toMatchObject({
			packageId: "package:test",
			contentHash: "a".repeat(64),
		});
	});
});
