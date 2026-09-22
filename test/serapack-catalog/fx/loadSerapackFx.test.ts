import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { loadSerapackFx } from "~/serapack-catalog/fx/loadSerapackFx";
import type { SerapackStorage } from "~/serapack-catalog/service/SerapackStorage";
import { SerakkiAppVersion } from "~shared/SerakkiAppMetadata";
import { testSerapackConfig } from "~test/serapack-support/fx/createTestSerapack";

const createFileFn = (
	packageId: string,
	props: Partial<SerapackStorage.LoadedFile> = {},
): SerapackStorage.LoadedFile => ({
	packageId,
	filename: `${encodeURIComponent(packageId)}.serapack`,
	contentHash: "a".repeat(64),
	title: "Package",
	version: "1.0",
	serakki: SerakkiAppVersion,
	projectRevision: 1,
	config: {
		...testSerapackConfig,
		meta: {
			...testSerapackConfig.meta,
			id: packageId,
		},
	},
	resources: [],
	provenance: {
		type: "community",
	},
	source: "user",
	overridesBundled: true,
	...props,
});

const createStorageFn = (files: ReadonlyArray<SerapackStorage.LoadedFile>): SerapackStorage => ({
	listFx: Effect.die("Unexpected catalog list."),
	readFx: (packageId) => Effect.succeed(files.filter((file) => file.packageId === packageId)),
	removeFx: () => Effect.void,
	openUserDirectoryFx: Effect.void,
});

describe("loadSerapackFx", () => {
	it("loads the exact installed package selected by package identity", async () => {
		const packageId = "package:selected";
		const loaded = await Effect.runPromise(
			loadSerapackFx({
				packageId,
				storage: createStorageFn([
					createFileFn(packageId),
				]),
			}),
		);

		expect(loaded.descriptor).toMatchObject({
			packageId,
			source: "user",
		});
		expect(loaded.payload.config.meta.id).toBe(packageId);
	});

	it("falls back from an invalid user record to the bundled installation", async () => {
		const packageId = "package:fallback";
		const loaded = await Effect.runPromise(
			loadSerapackFx({
				packageId,
				storage: createStorageFn([
					createFileFn(packageId, {
						source: "bundled",
						overridesBundled: false,
						provenance: {
							type: "official",
						},
					}),
					createFileFn(packageId, {
						config: {
							...testSerapackConfig,
							meta: {
								...testSerapackConfig.meta,
								id: "other",
							},
						},
					}),
				]),
			}),
		);

		expect(loaded.descriptor).toMatchObject({
			source: "bundled",
			provenance: {
				type: "official",
			},
		});
	});

	it("fails when the requested package is absent", async () => {
		await expect(
			Effect.runPromise(
				loadSerapackFx({
					packageId: "missing",
					storage: createStorageFn([]),
				}),
			),
		).rejects.toThrow("Serapack missing is not installed");
	});
});
