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
const artifact = "game/arkini/build/arkini.arkpack";
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
				ARKINI_PREBUILT_ARKPACK: "",
				ARKINI_RELEASE_SIGN: "",
				ARKINI_EXPECTED_PROVENANCE: "community",
				...env,
				ARKINI_MISE_ACTIVE: "1",
				PATH: `${join(root, "bin")}${delimiter}${process.env.PATH}`,
			},
		},
	);
const fingerprintFn = async () => (await runFn("arkpack-fingerprint")).stdout.trim();
const countFn = async () => Number(await readFile(join(root, "pack-count"), "utf8"));

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "arkini-build-cache-"));
	for (const dir of [
		"src",
		"shared",
		"electron",
		"scripts",
		"bin",
		"game/arkini/items",
		"game/arkini/assets",
		"game/arkini/resources",
		"game/arkini/notes",
		".out/desktop/build/main/cli",
	]) {
		await mkdir(join(root, dir), {
			recursive: true,
		});
	}
	await copyFile(resolve("Argcfile.sh"), join(root, "Argcfile.sh"));
	for (const file of [
		"game/arkini/game.json",
		"game/arkini/project.json",
		"game/arkini/schema.json",
		"package.json",
		"package-lock.json",
		"tsconfig.json",
	]) {
		await writeFile(join(root, file), "{}");
	}
	await writeFile(join(root, "mise.toml"), "");
	await writeFile(join(root, "electron.vite.config.ts"), "export default {};");
	await writeFile(join(root, "src/builder.ts"), "export const builder = 1;");
	await writeFile(join(root, "game/arkini/assets/a space.png"), "image bytes");
	await writeFile(join(root, "bin/electron-vite"), "#!/usr/bin/env bash\nexit 0\n", {
		mode: 0o755,
	});
	// Isolate expensive compilation while exercising the real Argcfile control flow and hasher.
	await writeFile(
		join(root, ".out/desktop/build/main/cli/arkini.js"),
		`
const fs = require("node:fs");
if (process.argv.includes("pack")) {
	const count = fs.existsSync("pack-count") ? Number(fs.readFileSync("pack-count", "utf8")) : 0;
	fs.writeFileSync("pack-count", String(count + 1));
	if (process.env.FAIL_PACK) process.exit(1);
	fs.mkdirSync("game/arkini/build", { recursive: true });
	fs.writeFileSync("${artifact}", "packed game " + count);
} else if (process.argv.includes("verify")) {
	if (process.env.FAIL_VERIFY) process.exit(1);
	console.log(JSON.stringify({ type: process.env.ARKINI_EXPECTED_PROVENANCE }));
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

describe("repository Arkpack build cache", () => {
	it("hashes content and membership, excluding Notes and build output", async () => {
		const initial = await fingerprintFn();
		expect(initial).toMatch(/^[a-f0-9]{64}$/);
		await writeFile(join(root, "game/arkini/notes/note.json"), "note");
		await mkdir(join(root, "game/arkini/build"));
		await writeFile(join(root, artifact), "old build");
		expect(await fingerprintFn()).toBe(initial);
		for (const file of [
			"src/builder.ts",
			"game/arkini/game.json",
			"package-lock.json",
			"game/arkini/assets/a space.png",
		]) {
			const before = await fingerprintFn();
			await appendFile(join(root, file), "changed");
			expect(await fingerprintFn()).not.toBe(before);
		}
		const beforeRename = await fingerprintFn();
		await rename(
			join(root, "game/arkini/assets/a space.png"),
			join(root, "game/arkini/assets/renamed.png"),
		);
		expect(await fingerprintFn()).not.toBe(beforeRename);
		await rm(join(root, "game/arkini/assets/renamed.png"));
		expect(await fingerprintFn()).not.toBe(beforeRename);
	});

	it("skips only intact builds and rebuilds after source changes or damaged cache", async () => {
		await runFn("build");
		expect((await runFn("build")).stdout).toContain("Arkpack unchanged");
		expect(await countFn()).toBe(1);
		await appendFile(join(root, "src/builder.ts"), "changed");
		await runFn("build");
		expect(await countFn()).toBe(2);
		await writeFile(join(root, artifact), "damaged");
		await runFn("build");
		expect(await countFn()).toBe(3);
		await writeFile(join(root, `${artifact}.cache`), "malformed");
		await runFn("build");
		expect(await countFn()).toBe(4);
		await rm(join(root, artifact));
		await runFn("build");
		expect(await countFn()).toBe(5);
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
			await mkdir(join(root, "game/arkini", marker));
			await runFn("build");
			await rm(join(root, "game/arkini", marker), {
				recursive: true,
			});
		}
		expect(await countFn()).toBe(2);
		await runFn("build", {
			ARKINI_RELEASE_SIGN: "1",
			ARKINI_EXPECTED_PROVENANCE: "official",
		});
		await runFn("build", {
			ARKINI_RELEASE_SIGN: "1",
			ARKINI_EXPECTED_PROVENANCE: "official",
		});
		expect(await countFn()).toBe(4);
	});
});
