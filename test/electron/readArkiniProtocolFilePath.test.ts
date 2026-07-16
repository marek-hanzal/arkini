import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readArkiniProtocolFilePath } from "../../electron/main/readArkiniProtocolFilePath";

let rendererRoot = "";

beforeEach(async () => {
	rendererRoot = await mkdtemp(join(tmpdir(), "arkini-protocol-"));
	await mkdir(join(rendererRoot, "assets"));
	await writeFile(join(rendererRoot, "index.html"), "<main>Arkini</main>");
	await writeFile(join(rendererRoot, "assets", "app.js"), "export {};");
});

afterEach(async () => {
	await rm(rendererRoot, {
		recursive: true,
		force: true,
	});
});

describe("readArkiniProtocolFilePath", () => {
	it("serves the renderer entry at the canonical application root", async () => {
		await expect(readArkiniProtocolFilePath("arkini://app/", rendererRoot)).resolves.toBe(
			join(rendererRoot, "index.html"),
		);
	});

	it("serves existing renderer assets directly", async () => {
		await expect(
			readArkiniProtocolFilePath("arkini://app/assets/app.js", rendererRoot),
		).resolves.toBe(join(rendererRoot, "assets", "app.js"));
	});

	it("falls back to the renderer entry for TanStack Router paths", async () => {
		await expect(
			readArkiniProtocolFilePath("arkini://app/game/builtin-arkini", rendererRoot),
		).resolves.toBe(join(rendererRoot, "index.html"));
	});

	it("rejects missing assets instead of hiding them behind SPA fallback", async () => {
		await expect(
			readArkiniProtocolFilePath("arkini://app/assets/missing.js", rendererRoot),
		).rejects.toMatchObject({
			status: 404,
		});
	});

	it("rejects unknown origins and encoded traversal", async () => {
		await expect(
			readArkiniProtocolFilePath("arkini://other/", rendererRoot),
		).rejects.toMatchObject({
			status: 404,
		});
		await expect(
			readArkiniProtocolFilePath("arkini://app/%2e%2e%2fsecret.txt", rendererRoot),
		).rejects.toMatchObject({
			status: 400,
		});
	});
});
