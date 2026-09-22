import { execFile } from "node:child_process";
import {
	mkdtemp,
	mkdir,
	readFile,
	rm,
	writeFile,
	appendFile,
	rename,
	copyFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const execFileFn = promisify(execFile);
let root: string;
const artifact = "game/serakki/build/serakki.serapack";
const runFn = (command: string, env: NodeJS.ProcessEnv = {}) =>
	execFileFn(
		"bash",
		[
			"Argcfile.sh",
			command,
		],
		{
			cwd: root,
			env: {
				...process.env,
				SERAKKI_PREBUILT_SERAPACK: "",
				SERAKKI_RELEASE_SIGN: "",
				SERAKKI_EXPECTED_PROVENANCE: "community",
				...env,
				SERAKKI_MISE_ACTIVE: "1",
				PATH: `${join(root, "bin")}${delimiter}${process.env.PATH}`,
			},
		},
	);
const fingerprintFn = async () => (await runFn("serapack-fingerprint")).stdout.trim();
const countFn = async () => Number(await readFile(join(root, "pack-count"), "utf8"));

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "serakki-build-cache-"));
	for (const dir of [
		"src",
		"shared",
		"electron",
		"scripts",
		"bin",
		"game/serakki/items",
		"game/serakki/artwork",
		"game/serakki/image",
		"game/serakki/music",
		"game/serakki/sfx",
		"game/serakki/notes",
		".out/desktop/build/main/cli",
	]) {
		await mkdir(join(root, dir), {
			recursive: true,
		});
	}
	await copyFile(resolve("Argcfile.sh"), join(root, "Argcfile.sh"));
	for (const file of [
		"game/serakki/game.json",
		"game/serakki/project.json",
		"game/serakki/schema.json",
		"package.json",
		"package-lock.json",
		"tsconfig.json",
	]) {
		await writeFile(join(root, file), "{}");
	}
	await writeFile(join(root, "mise.toml"), "");
	await writeFile(join(root, "electron.vite.config.ts"), "export default {};");
	await writeFile(join(root, "src/builder.ts"), "export const builder = 1;");
	await writeFile(join(root, "game/serakki/artwork/a space.png"), "image bytes");
	await writeFile(join(root, "game/serakki/music/theme.ogg"), "music bytes");
	await writeFile(join(root, "game/serakki/music/theme.json"), '{"name":"Theme"}');
	await writeFile(join(root, "game/serakki/sfx/click.ogg"), "sfx bytes");
	await writeFile(join(root, "game/serakki/sfx/click.json"), '{"name":"Click"}');
	await writeFile(join(root, "bin/electron-vite"), "#!/usr/bin/env bash\nexit 0\n", {
		mode: 0o755,
	});
	// Isolate expensive compilation while exercising the real Argcfile control flow and hasher.
	await writeFile(join(root, ".out/desktop/build/main/index.js"), "");
	await writeFile(
		join(root, ".out/desktop/build/main/cli/serakki.js"),
		`
const fs = require("node:fs");
if (process.argv.includes("pack")) {
	const count = fs.existsSync("pack-count") ? Number(fs.readFileSync("pack-count", "utf8")) : 0;
	fs.writeFileSync("pack-count", String(count + 1));
	if (process.env.FAIL_PACK) process.exit(1);
	fs.mkdirSync("game/serakki/build", { recursive: true });
	fs.writeFileSync("${artifact}", "packed game " + count);
} else if (process.argv.includes("verify")) {
	if (process.env.FAIL_VERIFY) process.exit(1);
	console.log(JSON.stringify({ type: process.env.SERAKKI_EXPECTED_PROVENANCE }));
} else process.exit(1);
`,
	);
});
afterEach(async () => {
	await rm(root, {
		recursive: true,
		force: true,
	});
});

describe("repository Serapack build cache", () => {
	it("hashes content and membership, excluding Notes and build output", async () => {
		const initial = await fingerprintFn();
		expect(initial).toMatch(/^[a-f0-9]{64}$/);
		await writeFile(join(root, "game/serakki/notes/note.json"), "note");
		await mkdir(join(root, "game/serakki/build"));
		await writeFile(join(root, artifact), "old build");
		expect(await fingerprintFn()).toBe(initial);
		let previous = initial;
		for (const file of [
			"src/builder.ts",
			"game/serakki/game.json",
			"package-lock.json",
			"game/serakki/artwork/a space.png",
			"game/serakki/music/theme.ogg",
			"game/serakki/music/theme.json",
			"game/serakki/sfx/click.ogg",
			"game/serakki/sfx/click.json",
		]) {
			await appendFile(join(root, file), "changed");
			const current = await fingerprintFn();
			expect(current).not.toBe(previous);
			previous = current;
		}
		await rename(
			join(root, "game/serakki/artwork/a space.png"),
			join(root, "game/serakki/artwork/renamed.png"),
		);
		const renamed = await fingerprintFn();
		expect(renamed).not.toBe(previous);
		await rm(join(root, "game/serakki/artwork/renamed.png"));
		expect(await fingerprintFn()).not.toBe(renamed);
		// Each fingerprint launches the real Bash pipeline; Windows process startup needs headroom.
	}, 30_000);

	it("skips only intact builds and rebuilds after source changes or damaged cache", async () => {
		await runFn("build");
		expect((await runFn("build")).stdout).toContain("Serapack unchanged");
		expect(await countFn()).toBe(1);
		await writeFile(join(root, "game/serakki/project.json"), '{"revision":1}');
		await runFn("build");
		expect(await countFn()).toBe(2);
		await appendFile(join(root, "src/builder.ts"), "changed");
		await runFn("build");
		expect(await countFn()).toBe(3);
		await writeFile(join(root, artifact), "damaged");
		await runFn("build");
		expect(await countFn()).toBe(4);
		await writeFile(join(root, `${artifact}.cache`), "malformed");
		await runFn("build");
		expect(await countFn()).toBe(5);
		await rm(join(root, artifact));
		await runFn("build");
		expect(await countFn()).toBe(6);
	});

	it("revalidates audio sidecar removal and corruption instead of reusing a valid build", async () => {
		await runFn("build");
		const previousArtifact = await readFile(join(root, artifact), "utf8");
		const previousCache = await readFile(join(root, `${artifact}.cache`), "utf8");
		await rm(join(root, "game/serakki/music/theme.json"));
		// The compiler owns pair validation; this boundary must reach it despite a cached pack.
		await expect(
			runFn("build", {
				FAIL_PACK: "1",
			}),
		).rejects.toThrow();
		expect(await countFn()).toBe(2);
		expect(await readFile(join(root, artifact), "utf8")).toBe(previousArtifact);
		expect(await readFile(join(root, `${artifact}.cache`), "utf8")).toBe(previousCache);

		await writeFile(join(root, "game/serakki/music/theme.json"), '{"name":"Theme"}');
		await writeFile(join(root, "game/serakki/sfx/click.json"), "{invalid");
		await expect(
			runFn("build", {
				FAIL_PACK: "1",
			}),
		).rejects.toThrow();
		expect(await countFn()).toBe(3);
		expect(await readFile(join(root, artifact), "utf8")).toBe(previousArtifact);
		expect(await readFile(join(root, `${artifact}.cache`), "utf8")).toBe(previousCache);
	});

	it("does not publish a reuse record after a failed build or verification", async () => {
		await expect(
			runFn("build", {
				FAIL_PACK: "1",
			}),
		).rejects.toThrow();
		await expect(readFile(join(root, `${artifact}.cache`))).rejects.toThrow();
		await expect(
			runFn("build", {
				FAIL_VERIFY: "1",
			}),
		).rejects.toThrow();
		await expect(readFile(join(root, `${artifact}.cache`))).rejects.toThrow();
	});

	it("keeps verification on hits and bypasses reuse for an active writer and release signing", async () => {
		await runFn("build");
		await expect(
			runFn("build", {
				FAIL_VERIFY: "1",
			}),
		).rejects.toThrow();
		expect(await countFn()).toBe(1);
		for (const marker of [
			"editor.lock",
		]) {
			await mkdir(join(root, "game/serakki", marker));
			await runFn("build");
			await rm(join(root, "game/serakki", marker), {
				recursive: true,
			});
		}
		expect(await countFn()).toBe(2);
		await runFn("build", {
			SERAKKI_RELEASE_SIGN: "1",
			SERAKKI_EXPECTED_PROVENANCE: "official",
		});
		await runFn("build", {
			SERAKKI_RELEASE_SIGN: "1",
			SERAKKI_EXPECTED_PROVENANCE: "official",
		});
		expect(await countFn()).toBe(4);
	});
});
