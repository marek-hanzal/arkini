import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { listArkpacksFx } from "~/arkpack-catalog/fx/listArkpacksFx";
import type { ArkpackStorage } from "~/arkpack-catalog/service/ArkpackStorage";
import { ArkiniAppVersion } from "~shared/ArkiniAppMetadata";

const createStorageFn = (files: ReadonlyArray<ArkpackStorage.Candidate>): ArkpackStorage => ({
	listFx: Effect.succeed(files),
	readFx: () => Effect.die("Unexpected exact read."),
	removeFx: () => Effect.void,
	openUserDirectoryFx: Effect.void,
});

describe("listArkpacksFx", () => {
	it("projects installed metadata without reading package bodies", async () => {
		const storage = createStorageFn([
			{
				packageId: "package:catalog",
				filename: "package%3Acatalog.arkpack",
				contentHash: "a".repeat(64),
				title: "Catalog",
				version: "1.0",
				arkini: ArkiniAppVersion,
				provenance: {
					type: "community",
				},
				source: "user",
				overridesBundled: true,
			},
		]);

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

	it("falls back to bundled metadata when the user record is invalid", async () => {
		const storage = createStorageFn([
			{
				packageId: "package:fallback",
				filename: "package%3Afallback.arkpack",
				contentHash: "a".repeat(64),
				title: "Bundled",
				version: "1.0",
				arkini: ArkiniAppVersion,
				provenance: {
					type: "official",
				},
				source: "bundled",
				overridesBundled: false,
			},
			{
				packageId: "package:fallback",
				filename: "package%3Afallback.arkpack",
				contentHash: "b".repeat(64),
				title: "Invalid",
				version: "invalid",
				arkini: ArkiniAppVersion,
				provenance: {
					type: "community",
				},
				source: "user",
				overridesBundled: true,
			},
		]);

		await expect(
			Effect.runPromise(
				listArkpacksFx({
					storage,
				}),
			),
		).resolves.toEqual([
			expect.objectContaining({
				packageId: "package:fallback",
				source: "bundled",
			}),
		]);
	});
});
