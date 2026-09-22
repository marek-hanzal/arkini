import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { importSerapackFileFx } from "~/serapack-catalog/fx/importSerapackFileFx";
import type { SerapackStorage } from "~/serapack-catalog/service/SerapackStorage";

describe("importSerapackFileFx", () => {
	it("delegates native selection and streamed import to storage", async () => {
		const imported: SerapackStorage.FilesystemFile = {
			packageId: "package:test",
			filename: "package%3Atest.serapack",
			contentHash: "a".repeat(64),
			title: "Test",
			version: "1.0",
			serakki: "0.5.0",
			projectRevision: 1,
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
			importFx: Effect.succeed(imported),
			openUserDirectoryFx: Effect.void,
		} satisfies SerapackStorage;

		await expect(
			Effect.runPromise(
				importSerapackFileFx({
					storage,
				}),
			),
		).resolves.toMatchObject({
			packageId: "package:test",
			contentHash: "a".repeat(64),
		});
	});
});
