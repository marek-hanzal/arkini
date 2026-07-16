import { access, mkdtemp, rm, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FilesystemArkpackCatalog } from "../../electron/main/arkpack/FilesystemArkpackCatalog";

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

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "arkini-arkpacks-"));
});
afterEach(async () => {
	await rm(root, {
		recursive: true,
		force: true,
	});
});

describe("FilesystemArkpackCatalog", () => {
	it("installs, lists metadata without payload I/O, reads one exact binary and removes atomically", async () => {
		const catalog = new FilesystemArkpackCatalog(root);
		await catalog.install({
			descriptor,
			bytes: packageBytes,
		});
		const restarted = new FilesystemArkpackCatalog(root);
		expect(await restarted.list()).toEqual([
			descriptor,
		]);

		const binaryPath = join(root, "arkini", "arkpacks", packageId, "package.arkpack");
		await unlink(binaryPath);
		expect(await catalog.list()).toEqual([
			descriptor,
		]);
		await expect(catalog.read(packageId)).rejects.toMatchObject({
			code: "ENOENT",
		});

		await catalog.install({
			descriptor,
			bytes: packageBytes,
		});
		expect(await catalog.read(packageId)).toEqual({
			descriptor,
			bytes: packageBytes,
		});

		await catalog.remove(packageId);
		await expect(access(join(root, "arkini", "arkpacks", packageId))).rejects.toBeDefined();
	});

	it("deduplicates exact package identities and rejects unsafe paths", async () => {
		const catalog = new FilesystemArkpackCatalog(root);
		await catalog.install({
			descriptor,
			bytes: packageBytes,
		});
		await catalog.install({
			descriptor,
			bytes: packageBytes,
		});
		expect(await catalog.list()).toHaveLength(1);
		await expect(
			catalog.install({
				descriptor,
				bytes: new Uint8Array([
					9,
					9,
					9,
				]),
			}),
		).rejects.toThrow("SHA-256");
		await expect(catalog.read("../escape")).rejects.toThrow("Invalid imported Arkpack");
	});
});
