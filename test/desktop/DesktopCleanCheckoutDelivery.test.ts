import { execFile } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import {
	copyFile,
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	rm,
	stat,
	symlink,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { ArkiniOfficialArkpackSigning } from "../../cli/arkpack/ArkiniOfficialArkpackSigning";
import { ProjectOutputPaths } from "../../shared/ProjectOutputPaths";
import { ArkpackTrustedKeysSchema } from "~/engine/pack/schema/ArkpackTrustedKeysSchema";

const execFileAsync = promisify(execFile);
const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
const bundledArkpackNames = [
	"arkini.game.arkpack",
	"arkini.game.arkpack.sig",
	"demo.game.arkpack",
] as const;

const copyTrackedWorkspace = async (target: string) => {
	const options = {
		cwd: process.cwd(),
		encoding: "buffer" as const,
		maxBuffer: 16 * 1024 * 1024,
	};
	const [{ stdout }, { stdout: ignoredStdout }] = await Promise.all([
		execFileAsync(
			"git",
			[
				"ls-files",
				"--cached",
				"--others",
				"--exclude-standard",
				"-z",
			],
			options,
		),
		execFileAsync(
			"git",
			[
				"ls-files",
				"--cached",
				"--ignored",
				"--exclude-standard",
				"-z",
			],
			options,
		),
	]);
	const ignored = new Set(ignoredStdout.toString("utf8").split("\0"));
	const workspaceFiles = stdout
		.toString("utf8")
		.split("\0")
		.filter((path) => path.length > 0 && !ignored.has(path));

	for (const relativePath of workspaceFiles) {
		try {
			await stat(resolve(relativePath));
		} catch (error) {
			if (
				typeof error === "object" &&
				error !== null &&
				"code" in error &&
				error.code === "ENOENT"
			) {
				continue;
			}
			throw error;
		}
		const output = join(target, relativePath);
		await mkdir(dirname(output), {
			recursive: true,
		});
		await copyFile(resolve(relativePath), output);
	}

	await symlink(resolve("node_modules"), join(target, "node_modules"), "dir");
};

const writeEphemeralOfficialSigningInputs = async (workspace: string) => {
	const pair = generateKeyPairSync("ed25519");
	const privateKey = pair.privateKey.export({
		format: "pem",
		type: "pkcs8",
	});
	const publicKey = pair.publicKey.export({
		format: "pem",
		type: "spki",
	});
	const privateKeyPath = join(workspace, ArkiniOfficialArkpackSigning.privateKeyPath);
	await mkdir(dirname(privateKeyPath), {
		recursive: true,
	});
	await writeFile(privateKeyPath, privateKey, {
		mode: 0o600,
	});

	const trustedKeysPath = join(workspace, ArkiniOfficialArkpackSigning.trustedKeysPath);
	const trustedKeys = ArkpackTrustedKeysSchema.parse(
		JSON.parse(await readFile(trustedKeysPath, "utf8")) as unknown,
	);
	let replaced = false;
	const keys = trustedKeys.keys.map((key) => {
		if (key.keyId !== ArkiniOfficialArkpackSigning.keyId) return key;
		replaced = true;
		return {
			...key,
			publicKey: publicKey.toString(),
		};
	});
	if (!replaced) throw new Error("Active test signing key is absent from its trusted registry.");
	await writeFile(
		trustedKeysPath,
		`${JSON.stringify(
			{
				...trustedKeys,
				keys,
			},
			undefined,
			"\t",
		)}\n`,
	);
};

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
	it("builds and packages bundled Arkpacks from a clean checkout", async () => {
		const workspace = await mkdtemp(join(tmpdir(), "arkini-clean-delivery-"));
		try {
			await copyTrackedWorkspace(workspace);
			await expect(stat(join(workspace, "game/arkini.game.arkpack"))).rejects.toMatchObject({
				code: "ENOENT",
			});
			await expect(
				stat(join(workspace, "game/arkini.game.arkpack.metadata.json")),
			).rejects.toMatchObject({
				code: "ENOENT",
			});
			await expect(stat(join(workspace, ProjectOutputPaths.root))).rejects.toMatchObject({
				code: "ENOENT",
			});
			await writeEphemeralOfficialSigningInputs(workspace);

			const environment = {
				...process.env,
			};
			delete environment.ARKINI_ARKPACK_PRIVATE_KEY;
			await runNpmScript(workspace, "build", environment);
			const packed = await stat(join(workspace, "game/arkini.game.arkpack"));
			expect(packed.isFile()).toBe(true);
			const signature = await stat(join(workspace, "game/arkini.game.arkpack.sig"));
			expect(signature.isFile()).toBe(true);
			const demo = await stat(join(workspace, "game/demo.game.arkpack"));
			expect(demo.isFile()).toBe(true);
			await expect(
				stat(join(workspace, "game/arkini.game.arkpack.metadata.json")),
			).rejects.toMatchObject({
				code: "ENOENT",
			});
			await expect(
				stat(join(workspace, "game/demo.game.arkpack.metadata.json")),
			).rejects.toMatchObject({
				code: "ENOENT",
			});
			await expect(stat(join(workspace, "game/demo.game.arkpack.sig"))).rejects.toMatchObject(
				{
					code: "ENOENT",
				},
			);
			const renderer = await stat(
				join(workspace, ProjectOutputPaths.desktop.build, "renderer/index.html"),
			);
			expect(renderer.isFile()).toBe(true);
			await expect(
				stat(join(workspace, ProjectOutputPaths.desktop.build, "renderer/arkpacks")),
			).rejects.toMatchObject({
				code: "ENOENT",
			});

			await runNpmScript(workspace, "package:stage", environment);
			await execFileAsync(
				join(workspace, "node_modules/.bin/electron-builder"),
				[
					"--config",
					"electron-builder.yml",
					"--mac",
					"--arm64",
					"--dir",
					"--publish",
					"never",
				],
				{
					cwd: workspace,
					env: environment,
					maxBuffer: 32 * 1024 * 1024,
				},
			);
			const packagedGame = join(
				workspace,
				ProjectOutputPaths.desktop.release,
				"mac-arm64/Arkini.app/Contents/Resources/game",
			);
			expect((await readdir(packagedGame)).sort()).toEqual(bundledArkpackNames);
			for (const name of bundledArkpackNames) {
				expect(await readFile(join(packagedGame, name))).toEqual(
					await readFile(join(workspace, "game", name)),
				);
			}
			await runNpmScript(workspace, "dc");
		} finally {
			await rm(workspace, {
				recursive: true,
				force: true,
			});
		}
	}, 180_000);
});
