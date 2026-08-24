import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";
import { createUnpackedMacAppFx } from "../../cli/desktop/createUnpackedMacAppFx";

const temporaryDirectories: string[] = [];
const originalPath = process.env.PATH;
const originalArgsPath = process.env.ARKINI_TEST_BUILDER_ARGS;

afterEach(async () => {
	process.env.PATH = originalPath;
	if (originalArgsPath === undefined) {
		delete process.env.ARKINI_TEST_BUILDER_ARGS;
	} else {
		process.env.ARKINI_TEST_BUILDER_ARGS = originalArgsPath;
	}
	await Promise.all(
		temporaryDirectories.splice(0).map((directory) =>
			rm(directory, {
				recursive: true,
				force: true,
			}),
		),
	);
});

describe("createUnpackedMacAppFx", () => {
	it.skipIf(process.platform === "win32")(
		"creates only the unpacked arm64 app and returns its exact path",
		async () => {
			const directory = await mkdtemp(join(tmpdir(), "arkini-builder-bin-"));
			temporaryDirectories.push(directory);
			const outputDirectory = join(directory, "release");
			const executable = join(directory, "electron-builder");
			const argsPath = join(directory, "args.json");
			await writeFile(
				executable,
				`#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
const outputIndex = args.indexOf("--config.directories.output");
const resources = path.resolve(args[outputIndex + 1], "mac-arm64/Arkini.app/Contents/Resources");
fs.mkdirSync(resources, { recursive: true });
fs.writeFileSync(path.join(resources, "app.asar"), "fixture");
fs.writeFileSync(process.env.ARKINI_TEST_BUILDER_ARGS, JSON.stringify(args));
`,
				"utf8",
			);
			await chmod(executable, 0o755);
			process.env.PATH = `${directory}:${originalPath ?? ""}`;
			process.env.ARKINI_TEST_BUILDER_ARGS = argsPath;

			const appPath = await Effect.runPromise(
				createUnpackedMacAppFx({
					arch: "arm64",
					outputDirectory,
				}).pipe(Effect.provide(NodeServices.layer)),
			);

			expect(appPath).toBe(resolve(outputDirectory, "mac-arm64/Arkini.app"));
			expect(JSON.parse(await readFile(argsPath, "utf8"))).toEqual([
				"--config",
				"electron-builder.yml",
				"--mac",
				"--arm64",
				"--dir",
				"--config.directories.output",
				outputDirectory,
				"--publish",
				"never",
			]);
		},
	);
});
