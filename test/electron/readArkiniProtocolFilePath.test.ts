import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readArkiniProtocolFilePathFx } from "../../electron/protocol/readArkiniProtocolFilePathFx";

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

describe("readArkiniProtocolFilePathFx", () => {
	it("serves the renderer entry at the canonical application root", async () => {
		await expect(
			Effect.runPromise(
				readArkiniProtocolFilePathFx({
					requestUrl: "arkini://app/",
					rendererRoot,
				}),
			),
		).resolves.toBe(join(rendererRoot, "index.html"));
	});

	it("serves existing renderer assets directly", async () => {
		await expect(
			Effect.runPromise(
				readArkiniProtocolFilePathFx({
					requestUrl: "arkini://app/assets/app.js",
					rendererRoot,
				}),
			),
		).resolves.toBe(join(rendererRoot, "assets", "app.js"));
	});

	it("falls back to the renderer entry for TanStack Router paths", async () => {
		await expect(
			Effect.runPromise(
				readArkiniProtocolFilePathFx({
					requestUrl: "arkini://app/game/arkini",
					rendererRoot,
				}),
			),
		).resolves.toBe(join(rendererRoot, "index.html"));
	});

	it("rejects missing assets instead of hiding them behind SPA fallback", async () => {
		await expect(
			Effect.runPromise(
				Effect.flip(
					readArkiniProtocolFilePathFx({
						requestUrl: "arkini://app/assets/missing.js",
						rendererRoot,
					}),
				),
			),
		).resolves.toMatchObject({
			status: 404,
		});
	});

	it("rejects unknown origins and encoded traversal", async () => {
		await expect(
			Effect.runPromise(
				Effect.flip(
					readArkiniProtocolFilePathFx({
						requestUrl: "arkini://other/",
						rendererRoot,
					}),
				),
			),
		).resolves.toMatchObject({
			status: 404,
		});
		await expect(
			Effect.runPromise(
				Effect.flip(
					readArkiniProtocolFilePathFx({
						requestUrl: "arkini://app/%2e%2e%2fsecret.txt",
						rendererRoot,
					}),
				),
			),
		).resolves.toMatchObject({
			status: 400,
		});
	});
});
