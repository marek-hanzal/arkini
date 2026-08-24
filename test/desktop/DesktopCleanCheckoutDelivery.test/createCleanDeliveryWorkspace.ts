import { execFile } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { ArkiniOfficialArkpackSigning } from "~/engine/pack/cli/ArkiniOfficialArkpackSigning";
import { ArkpackTrustedKeysSchema } from "~/engine/pack/schema/ArkpackTrustedKeysSchema";

const execFileAsync = promisify(execFile);
const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";

const copyCurrentSources = async (target: string) => {
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
	const sourceFiles = stdout
		.toString("utf8")
		.split("\0")
		.filter((path) => path.length > 0 && !ignored.has(path));

	for (const relativePath of sourceFiles) {
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

const writeSigningInputs = async (workspace: string) => {
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

const initializeRepository = async (workspace: string) => {
	await execFileAsync(
		"git",
		[
			"init",
			"--quiet",
		],
		{
			cwd: workspace,
		},
	);
	await execFileAsync(
		"git",
		[
			"add",
			"--all",
		],
		{
			cwd: workspace,
		},
	);
	await execFileAsync(
		"git",
		[
			"-c",
			"user.name=Arkini Delivery Test",
			"-c",
			"user.email=delivery-test@arkini.invalid",
			"commit",
			"--quiet",
			"-m",
			"Test source snapshot",
		],
		{
			cwd: workspace,
		},
	);
};

export const createCleanDeliveryWorkspace = async () => {
	const root = await mkdtemp(join(tmpdir(), "arkini-clean-delivery-"));
	await copyCurrentSources(root);
	await writeSigningInputs(root);
	await initializeRepository(root);
	const environment = {
		...process.env,
	};
	delete environment.ARKINI_ARKPACK_PRIVATE_KEY;
	return {
		root,
		dispose: () =>
			rm(root, {
				recursive: true,
				force: true,
			}),
		readStatus: async () => {
			const { stdout } = await execFileAsync(
				"git",
				[
					"status",
					"--porcelain",
				],
				{
					cwd: root,
				},
			);
			return stdout;
		},
		runNpmScript: (script: string) =>
			execFileAsync(
				npmExecutable,
				[
					"run",
					script,
				],
				{
					cwd: root,
					env: environment,
					maxBuffer: 32 * 1024 * 1024,
				},
			),
	};
};
