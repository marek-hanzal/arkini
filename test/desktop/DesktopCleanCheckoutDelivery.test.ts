import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";

const copyTrackedWorkspace = async (target: string) => {
	const { stdout } = await execFileAsync(
		"git",
		[
			"ls-files",
			"-z",
		],
		{
			cwd: process.cwd(),
			encoding: "buffer",
			maxBuffer: 16 * 1024 * 1024,
		},
	);
	const trackedFiles = stdout
		.toString("utf8")
		.split("\0")
		.filter((path) => path.length > 0);

	for (const relativePath of trackedFiles) {
		const output = join(target, relativePath);
		await mkdir(dirname(output), {
			recursive: true,
		});
		await copyFile(resolve(relativePath), output);
	}

	await symlink(resolve("node_modules"), join(target, "node_modules"), "dir");
};

const readOfficialPrivateKey = async () =>
	process.env.ARKINI_ARKPACK_PRIVATE_KEY ??
	(await readFile(resolve(".arkini/arkpack-private.pem"), "utf8"));

const runNpmScript = async (
	cwd: string,
	script: string,
	environment: NodeJS.ProcessEnv = process.env,
) => {
	await execFileAsync(
		npmExecutable,
		[
			"run",
			script,
		],
		{
			cwd,
			env: environment,
			maxBuffer: 32 * 1024 * 1024,
		},
	);
};

describe("fresh checkout desktop delivery inputs", () => {
	it("builds from a clean checkout before dependency analysis consumes generated inputs", async () => {
		const workspace = await mkdtemp(join(tmpdir(), "arkini-clean-delivery-"));
		try {
			const privateKey = await readOfficialPrivateKey();
			await copyTrackedWorkspace(workspace);
			await expect(stat(join(workspace, "game/arkini.game.arkpack"))).rejects.toMatchObject({
				code: "ENOENT",
			});
			await expect(stat(join(workspace, ".arkini"))).rejects.toMatchObject({
				code: "ENOENT",
			});

			await runNpmScript(workspace, "build", {
				...process.env,
				ARKINI_ARKPACK_PRIVATE_KEY: privateKey,
			});
			const packed = await stat(join(workspace, "game/arkini.game.arkpack"));
			expect(packed.isFile()).toBe(true);
			const signature = await stat(join(workspace, "game/arkini.game.arkpack.sig"));
			expect(signature.isFile()).toBe(true);
			const demo = await stat(join(workspace, "game/demo.game.arkpack"));
			expect(demo.isFile()).toBe(true);
			await expect(stat(join(workspace, "game/demo.game.arkpack.sig"))).rejects.toMatchObject(
				{
					code: "ENOENT",
				},
			);
			const renderer = await stat(join(workspace, "out/renderer/index.html"));
			expect(renderer.isFile()).toBe(true);
			await runNpmScript(workspace, "dc");
		} finally {
			await rm(workspace, {
				recursive: true,
				force: true,
			});
		}
	}, 120_000);
});
