import * as NodeServices from "@effect/platform-node/NodeServices";
import {
	access,
	mkdir,
	mkdtemp,
	readFile,
	realpath,
	rename,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EditorJsonExportOwnershipFile } from "../../../electron/main/editor-project/EditorJsonExportRecoveryRecord";
import { recoverEditorJsonExportsFx } from "../../../electron/main/editor-project/recoverEditorJsonExportsFx";

const electron = vi.hoisted(() => {
	const paths = {
		app: "",
		home: "",
		userData: "",
	};
	return {
		getAppPath: vi.fn(() => paths.app),
		getPath: vi.fn((name: "home" | "userData") => paths[name]),
		paths,
	};
});

vi.mock("electron", () => ({
	app: {
		getAppPath: electron.getAppPath,
		getPath: electron.getPath,
	},
}));

let root = "";
let recoveryRoot = "";

beforeEach(async () => {
	root = await realpath(await mkdtemp(join(tmpdir(), "arkini-editor-export-recovery-")));
	recoveryRoot = join(root, "recovery");
	electron.paths.app = join(root, "protected", "app");
	electron.paths.home = join(root, "protected", "home");
	electron.paths.userData = join(root, "protected", "user-data");
	await Promise.all(
		[
			recoveryRoot,
			...Object.values(electron.paths),
		].map((directory) =>
			mkdir(directory, {
				recursive: true,
			}),
		),
	);
});

afterEach(async () => {
	await rm(root, {
		force: true,
		recursive: true,
	});
});

const writeRecovery = async ({
	hadTarget,
	moved = false,
	source,
	target,
	transaction,
}: {
	readonly hadTarget: boolean;
	readonly moved?: boolean;
	readonly source: string;
	readonly target: string;
	readonly transaction: string;
}) => {
	const directory = join(recoveryRoot, transaction);
	await mkdir(directory);
	await Promise.all([
		writeFile(
			join(directory, "record.json"),
			`${JSON.stringify({
				hadTarget,
				source,
				target,
				transaction,
			})}\n`,
		),
		writeFile(join(directory, "publishing"), "1"),
		...(moved
			? [
					writeFile(join(directory, "moved"), "1"),
				]
			: []),
	]);
	return directory;
};

const recover = () =>
	Effect.runPromise(
		recoverEditorJsonExportsFx(recoveryRoot).pipe(Effect.provide(NodeServices.layer)),
	);

describe("recoverEditorJsonExportsFx", () => {
	it("restores a moved target from a reusable backup", async () => {
		const transaction = "11111111-1111-4111-8111-111111111111";
		const source = join(root, "source");
		const target = join(root, "target");
		const previous = join(root, `.target.${transaction}.previous`);
		await Promise.all([
			mkdir(target),
			mkdir(previous),
		]);
		await Promise.all([
			writeFile(join(target, "sentinel.txt"), "new"),
			writeFile(join(target, EditorJsonExportOwnershipFile), transaction),
			writeFile(join(previous, "sentinel.txt"), "old"),
		]);
		const recoveryDirectory = await writeRecovery({
			hadTarget: true,
			moved: true,
			source,
			target,
			transaction,
		});

		await recover();

		await expect(readFile(join(target, "sentinel.txt"), "utf8")).resolves.toBe("old");
		await expect(access(recoveryDirectory)).rejects.toBeDefined();
	});

	it("keeps a healthy target when the process stopped before its first rename", async () => {
		const transaction = "22222222-2222-4222-8222-222222222222";
		const source = join(root, "source");
		const target = join(root, "target");
		await mkdir(target);
		await writeFile(join(target, "sentinel.txt"), "healthy");
		await writeRecovery({
			hadTarget: true,
			source,
			target,
			transaction,
		});

		await recover();

		await expect(readFile(join(target, "sentinel.txt"), "utf8")).resolves.toBe("healthy");
	});

	it("rejects a forged recovery target before any recursive removal", async () => {
		const transaction = "33333333-3333-4333-8333-333333333333";
		await writeRecovery({
			hadTarget: false,
			source: join(root, "source"),
			target: "/",
			transaction,
		});

		await expect(recover()).rejects.toThrow("filesystem root");
		await expect(access("/")).resolves.toBeUndefined();
		await expect(access(join(recoveryRoot, transaction))).resolves.toBeUndefined();
	});

	it("does not remove an unowned dedicated target from a stale journal", async () => {
		const transaction = "44444444-4444-4444-8444-444444444444";
		const target = join(root, "unowned-target");
		await mkdir(target);
		await writeFile(join(target, "sentinel.txt"), "keep");
		await writeRecovery({
			hadTarget: false,
			source: join(root, "source"),
			target,
			transaction,
		});

		await expect(recover()).rejects.toThrow("is not owned");
		await expect(readFile(join(target, "sentinel.txt"), "utf8")).resolves.toBe("keep");
	});

	it("does not replace an unowned target even when the previous backup exists", async () => {
		const transaction = "66666666-6666-4666-8666-666666666666";
		const target = join(root, "replaced-target");
		const previous = join(root, `.replaced-target.${transaction}.previous`);
		await Promise.all([
			mkdir(target),
			mkdir(previous),
		]);
		await Promise.all([
			writeFile(join(target, "sentinel.txt"), "new-owner"),
			writeFile(join(previous, "sentinel.txt"), "old-export"),
		]);
		await writeRecovery({
			hadTarget: true,
			moved: true,
			source: join(root, "source"),
			target,
			transaction,
		});

		await expect(recover()).rejects.toThrow("is not owned");
		await expect(readFile(join(target, "sentinel.txt"), "utf8")).resolves.toBe("new-owner");
		await expect(readFile(join(previous, "sentinel.txt"), "utf8")).resolves.toBe("old-export");
	});

	it("finishes cleanup without reinterpreting a terminal journal", async () => {
		const transaction = "55555555-5555-4555-8555-555555555555";
		const target = join(root, "restored-target");
		const previous = join(root, `.restored-target.${transaction}.previous`);
		await Promise.all([
			mkdir(target),
			mkdir(previous),
		]);
		await writeFile(join(target, "sentinel.txt"), "restored");
		const recoveryDirectory = await writeRecovery({
			hadTarget: true,
			moved: true,
			source: join(root, "source"),
			target,
			transaction,
		});
		const cleanupDirectory = `${recoveryDirectory}.cleanup`;
		await rename(recoveryDirectory, cleanupDirectory);

		await recover();

		await expect(readFile(join(target, "sentinel.txt"), "utf8")).resolves.toBe("restored");
		await expect(access(previous)).rejects.toBeDefined();
		await expect(access(cleanupDirectory)).rejects.toBeDefined();
	});

	it("finishes an active journal after its previous target was already restored", async () => {
		const transaction = "88888888-8888-4888-8888-888888888888";
		const target = join(root, "already-restored-target");
		const previous = join(root, `.already-restored-target.${transaction}.previous`);
		await Promise.all([
			mkdir(target),
			mkdir(previous),
		]);
		await Promise.all([
			writeFile(join(target, "sentinel.txt"), "restored"),
			writeFile(join(previous, "sentinel.txt"), "backup"),
		]);
		const recoveryDirectory = await writeRecovery({
			hadTarget: true,
			moved: true,
			source: join(root, "source"),
			target,
			transaction,
		});
		await writeFile(join(recoveryDirectory, "restoring"), "1");

		await recover();

		await expect(readFile(join(target, "sentinel.txt"), "utf8")).resolves.toBe("restored");
		await expect(access(previous)).rejects.toBeDefined();
		await expect(access(recoveryDirectory)).rejects.toBeDefined();
	});

	it("fails closed when restoring is durable but its artifact is missing", async () => {
		const transaction = "99999999-9999-4999-8999-999999999999";
		const target = join(root, "owned-target");
		const previous = join(root, `.owned-target.${transaction}.previous`);
		await Promise.all([
			mkdir(target),
			mkdir(previous),
		]);
		await Promise.all([
			writeFile(join(target, EditorJsonExportOwnershipFile), transaction),
			writeFile(join(target, "sentinel.txt"), "published"),
			writeFile(join(previous, "sentinel.txt"), "backup"),
		]);
		const recoveryDirectory = await writeRecovery({
			hadTarget: true,
			moved: true,
			source: join(root, "source"),
			target,
			transaction,
		});
		await writeFile(join(recoveryDirectory, "restoring"), "1");

		await expect(recover()).rejects.toThrow("artifact");
		await expect(readFile(join(target, "sentinel.txt"), "utf8")).resolves.toBe("published");
		await expect(readFile(join(previous, "sentinel.txt"), "utf8")).resolves.toBe("backup");
	});

	it("finishes a partially removed cleanup journal with no record", async () => {
		const transaction = "77777777-7777-4777-8777-777777777777";
		const recoveryDirectory = await writeRecovery({
			hadTarget: false,
			source: join(root, "source"),
			target: join(root, "missing-target"),
			transaction,
		});
		const cleanupDirectory = `${recoveryDirectory}.cleanup`;
		await rename(recoveryDirectory, cleanupDirectory);
		await rm(join(cleanupDirectory, "record.json"));

		await recover();

		await expect(access(cleanupDirectory)).rejects.toBeDefined();
	});
});
