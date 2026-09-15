import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { loadArkpackFx } from "~/arkpack-catalog/fx/loadArkpackFx";
import type { ArkpackStorage } from "~/arkpack-catalog/service/ArkpackStorage";
import { ArkiniAppVersion } from "~shared/ArkiniAppMetadata";
import { testArkpackConfig } from "~test/arkpack-support/fx/createTestArkpack";

const createFileFn = (
	packageId: string,
	props: Partial<ArkpackStorage.LoadedFile> = {},
): ArkpackStorage.LoadedFile => ({
	packageId,
	filename: `${encodeURIComponent(packageId)}.arkpack`,
	contentHash: "a".repeat(64),
	title: "Package",
	version: "1.0",
	arkini: ArkiniAppVersion,
	config: {
		...testArkpackConfig,
		meta: {
			...testArkpackConfig.meta,
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

const createStorageFn = (files: ReadonlyArray<ArkpackStorage.LoadedFile>): ArkpackStorage => ({
	listFx: Effect.die("Unexpected catalog list."),
	readFx: (packageId) => Effect.succeed(files.filter((file) => file.packageId === packageId)),
	removeFx: () => Effect.void,
	openUserDirectoryFx: Effect.void,
});

describe("loadArkpackFx", () => {
	it("loads the exact installed package selected by package identity", async () => {
		const packageId = "package:selected";
		const loaded = await Effect.runPromise(
			loadArkpackFx({
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
			loadArkpackFx({
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
							...testArkpackConfig,
							meta: {
								...testArkpackConfig.meta,
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
				loadArkpackFx({
					packageId: "missing",
					storage: createStorageFn([]),
				}),
			),
		).rejects.toThrow("Arkpack missing is not installed");
	});
});
