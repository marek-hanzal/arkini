import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifyRendererAssetGraphFx } from "../../electron/verify/verifyRendererAssetGraphFx";

let rendererRoot = "";

beforeEach(async () => {
	rendererRoot = await mkdtemp(join(tmpdir(), "arkini-renderer-assets-"));
	await mkdir(join(rendererRoot, "assets"));
	await writeFile(join(rendererRoot, "assets", "app.js"), "export {};\n");
	await writeFile(join(rendererRoot, "assets", "app.css"), "body {}\n");
});

afterEach(async () => {
	await rm(rendererRoot, {
		recursive: true,
		force: true,
	});
});

describe("verifyRendererAssetGraphFx", () => {
	it("accepts root-based generated assets from every representative history route", async () => {
		await writeFile(
			join(rendererRoot, "index.html"),
			'<base href="/"><script type="module" src="./assets/app.js"></script><link rel="stylesheet" href="./assets/app.css">',
		);

		await expect(verifyRendererAssetGraphFx(rendererRoot)).resolves.toBeUndefined();
	});

	it("rejects document-relative output without the root base contract", async () => {
		await writeFile(
			join(rendererRoot, "index.html"),
			'<script type="module" src="./assets/app.js"></script>',
		);

		await expect(verifyRendererAssetGraphFx(rendererRoot)).rejects.toThrow(
			'The production renderer must declare <base href="/">.',
		);
	});

	it("rejects generated references whose target file is missing", async () => {
		await writeFile(
			join(rendererRoot, "index.html"),
			'<base href="/"><script type="module" src="./assets/missing.js"></script>',
		);

		await expect(verifyRendererAssetGraphFx(rendererRoot)).rejects.toThrow();
	});
});
