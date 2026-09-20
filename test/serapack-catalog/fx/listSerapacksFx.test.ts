import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { listSerapacksFx } from "~/serapack-catalog/fx/listSerapacksFx";
import type { SerapackStorage } from "~/serapack-catalog/service/SerapackStorage";
import { SerakkiAppVersion } from "~shared/SerakkiAppMetadata";

const createStorageFn = (files: ReadonlyArray<SerapackStorage.Candidate>): SerapackStorage => ({
	listFx: Effect.succeed(files),
	readFx: () => Effect.die("Unexpected exact read."),
	removeFx: () => Effect.void,
	openUserDirectoryFx: Effect.void,
});

describe("listSerapacksFx", () => {
	it("projects installed metadata without reading package bodies", async () => {
		const storage = createStorageFn([
			{
				packageId: "package:catalog",
				filename: "package%3Acatalog.serapack",
				contentHash: "a".repeat(64),
				title: "Catalog",
				version: "1.0",
				serakki: SerakkiAppVersion,
				provenance: {
					type: "community",
				},
				source: "user",
				overridesBundled: true,
			},
		]);

		await expect(
			Effect.runPromise(
				listSerapacksFx({
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
				filename: "package%3Afallback.serapack",
				contentHash: "a".repeat(64),
				title: "Bundled",
				version: "1.0",
				serakki: SerakkiAppVersion,
				provenance: {
					type: "official",
				},
				source: "bundled",
				overridesBundled: false,
			},
			{
				packageId: "package:fallback",
				filename: "package%3Afallback.serapack",
				contentHash: "b".repeat(64),
				title: "Invalid",
				version: "invalid",
				serakki: SerakkiAppVersion,
				provenance: {
					type: "community",
				},
				source: "user",
				overridesBundled: true,
			},
		]);

		await expect(
			Effect.runPromise(
				listSerapacksFx({
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
