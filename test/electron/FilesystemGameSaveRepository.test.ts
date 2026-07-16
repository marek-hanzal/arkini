import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import * as filesystem from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FilesystemGameSaveRepository } from "../../electron/main/save/FilesystemGameSaveRepository";

let root = "";
const first = {
	packageId: "arkini",
	contentHash: "a".repeat(64),
};
const second = {
	packageId: "arkini",
	contentHash: "b".repeat(64),
};

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "arkini-saves-"));
});
afterEach(async () => {
	await rm(root, {
		recursive: true,
		force: true,
	});
});

describe("FilesystemGameSaveRepository", () => {
	it("writes exact saves through pending/current replacement and isolates clear", async () => {
		const repository = new FilesystemGameSaveRepository(root);
		await repository.write(
			first,
			new Uint8Array([
				1,
				2,
			]),
		);
		await repository.write(
			second,
			new Uint8Array([
				3,
				4,
			]),
		);
		expect(await repository.read(first)).toEqual(
			new Uint8Array([
				1,
				2,
			]),
		);
		expect(await repository.read(second)).toEqual(
			new Uint8Array([
				3,
				4,
			]),
		);
		await expect(
			access(join(root, "arkini", "saves", "arkini", first.contentHash, "pending.arksave")),
		).rejects.toBeDefined();
		await repository.clear(first);
		expect(await repository.read(first)).toBeNull();
		expect(await repository.read(second)).toEqual(
			new Uint8Array([
				3,
				4,
			]),
		);
	});

	it("preserves the previous current save when atomic replacement fails", async () => {
		const repository = new FilesystemGameSaveRepository(root);
		await repository.write(
			first,
			new Uint8Array([
				1,
				2,
				3,
			]),
		);
		const failing = new FilesystemGameSaveRepository(root, {
			...filesystem,
			rename: async () => {
				throw new Error("rename failed");
			},
		});
		await expect(
			failing.write(
				first,
				new Uint8Array([
					9,
				]),
			),
		).rejects.toThrow("rename failed");
		expect(await repository.read(first)).toEqual(
			new Uint8Array([
				1,
				2,
				3,
			]),
		);
		await expect(
			access(join(root, "arkini", "saves", "arkini", first.contentHash, "pending.arksave")),
		).rejects.toBeDefined();
	});

	it("replaces the complete current file and rejects unsafe keys", async () => {
		const repository = new FilesystemGameSaveRepository(root);
		await repository.write(
			first,
			new Uint8Array([
				1,
				2,
				3,
				4,
			]),
		);
		await repository.write(
			first,
			new Uint8Array([
				9,
			]),
		);
		const path = join(root, "arkini", "saves", "arkini", first.contentHash, "current.arksave");
		expect(new Uint8Array(await readFile(path))).toEqual(
			new Uint8Array([
				9,
			]),
		);
		await expect(
			repository.write(
				{
					packageId: "../escape",
					contentHash: first.contentHash,
				},
				new Uint8Array(),
			),
		).rejects.toThrow("Invalid Arkini save identity");
	});
});
