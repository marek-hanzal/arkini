import { NodeContext } from "@effect/platform-node";
import { Effect } from "effect";
import { createHash } from "node:crypto";
import { access, mkdtemp, rm, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFilesystemArkpackCatalogFx } from "../../electron/main/arkpack/createFilesystemArkpackCatalogFx";

let root = "";
const packageBytes = new Uint8Array([
	1,
	2,
	3,
]);
const packageId = createHash("sha256").update(packageBytes).digest("hex");
const descriptor = {
	packageId,
	contentHash: packageId,
	gameId: "game:test",
	title: "Test",
	configVersion: "1.0",
	compressedSize: 3,
	source: "imported" as const,
	filename: "test.arkpack",
	importedAtMs: 1,
};

const createCatalog = () =>
	Effect.runPromise(
		createFilesystemArkpackCatalogFx({
			userDataPath: root,
		}).pipe(Effect.provide(NodeContext.layer)),
	);

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "arkini-arkpacks-"));
});
afterEach(async () => {
	await rm(root, {
		recursive: true,
		force: true,
	});
});

describe("createFilesystemArkpackCatalogFx", () => {
	it("installs, lists metadata without payload I/O, reads one exact binary and removes atomically", async () => {
		const catalog = await createCatalog();
		await Effect.runPromise(
			catalog.installFx({
				descriptor,
				bytes: packageBytes,
			}),
		);
		const restarted = await createCatalog();
		expect(await Effect.runPromise(restarted.listFx)).toEqual([
			descriptor,
		]);

		const binaryPath = join(root, "arkini", "arkpacks", packageId, "package.arkpack");
		await unlink(binaryPath);
		expect(await Effect.runPromise(catalog.listFx)).toEqual([
			descriptor,
		]);
		await expect(Effect.runPromise(catalog.readFx(packageId))).rejects.toBeDefined();

		await Effect.runPromise(
			catalog.installFx({
				descriptor,
				bytes: packageBytes,
			}),
		);
		expect(await Effect.runPromise(catalog.readFx(packageId))).toEqual({
			descriptor,
			bytes: packageBytes,
		});

		await Effect.runPromise(catalog.removeFx(packageId));
		await expect(access(join(root, "arkini", "arkpacks", packageId))).rejects.toBeDefined();
	});

	it("deduplicates exact package identities and rejects unsafe paths", async () => {
		const catalog = await createCatalog();
		await Effect.runPromise(
			catalog.installFx({
				descriptor,
				bytes: packageBytes,
			}),
		);
		await Effect.runPromise(
			catalog.installFx({
				descriptor,
				bytes: packageBytes,
			}),
		);
		expect(await Effect.runPromise(catalog.listFx)).toHaveLength(1);
		await expect(
			Effect.runPromise(
				catalog.installFx({
					descriptor,
					bytes: new Uint8Array([
						9,
						9,
						9,
					]),
				}),
			),
		).rejects.toThrow("SHA-256");
		await expect(Effect.runPromise(catalog.readFx("../escape"))).rejects.toThrow(
			"Invalid imported Arkpack",
		);
	});
});
