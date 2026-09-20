import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readSerakkiProtocolFilePathFx } from "~electron/protocol/readSerakkiProtocolFilePathFx";

let rendererRoot = "";

beforeEach(async () => {
	rendererRoot = await mkdtemp(join(tmpdir(), "serakki-protocol-"));
	await mkdir(join(rendererRoot, "assets"));
	await writeFile(join(rendererRoot, "index.html"), "<main>Serakki</main>");
	await writeFile(join(rendererRoot, "assets", "app.js"), "export {};");
});

afterEach(async () => {
	await rm(rendererRoot, {
		recursive: true,
		force: true,
	});
});

describe("readSerakkiProtocolFilePathFx", () => {
	it("serves the renderer entry at the canonical application root", async () => {
		await expect(
			Effect.runPromise(
				readSerakkiProtocolFilePathFx({
					requestUrl: "serakki://app/",
					rendererRoot,
				}),
			),
		).resolves.toBe(join(rendererRoot, "index.html"));
	});

	it("serves existing renderer assets directly", async () => {
		await expect(
			Effect.runPromise(
				readSerakkiProtocolFilePathFx({
					requestUrl: "serakki://app/assets/app.js",
					rendererRoot,
				}),
			),
		).resolves.toBe(join(rendererRoot, "assets", "app.js"));
	});

	it("falls back to the renderer entry for TanStack Router paths", async () => {
		await expect(
			Effect.runPromise(
				readSerakkiProtocolFilePathFx({
					requestUrl: "serakki://app/game/serakki",
					rendererRoot,
				}),
			),
		).resolves.toBe(join(rendererRoot, "index.html"));
	});

	it("rejects missing assets instead of hiding them behind SPA fallback", async () => {
		await expect(
			Effect.runPromise(
				Effect.flip(
					readSerakkiProtocolFilePathFx({
						requestUrl: "serakki://app/assets/missing.js",
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
					readSerakkiProtocolFilePathFx({
						requestUrl: "serakki://other/",
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
					readSerakkiProtocolFilePathFx({
						requestUrl: "serakki://app/%2e%2e%2fsecret.txt",
						rendererRoot,
					}),
				),
			),
		).resolves.toMatchObject({
			status: 400,
		});
	});
});
