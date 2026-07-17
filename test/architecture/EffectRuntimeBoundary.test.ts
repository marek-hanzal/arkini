import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const activeRoots = [
	resolve("src/engine"),
	resolve("src/bridge"),
	resolve("src/ui"),
	resolve("src/page"),
	resolve("src/@routes"),
	resolve("electron"),
	resolve("cli"),
];

const readTypeScriptFiles = (directory: string): string[] =>
	readdirSync(directory, {
		withFileTypes: true,
	}).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return readTypeScriptFiles(path);
		return entry.isFile() && /\.tsx?$/.test(entry.name)
			? [
					path,
				]
			: [];
	});

const activeFiles = activeRoots.flatMap(readTypeScriptFiles);
const projectPath = (file: string) => relative(resolve("."), file).replaceAll("\\", "/");

describe("Effect runtime ownership", () => {
	it("keeps exactly one explicit runtime root per process and one owned runtime per live game", () => {
		const runtimeFactories = activeFiles
			.filter((file) => readFileSync(file, "utf8").includes("ManagedRuntime.make"))
			.map(projectPath)
			.sort();

		expect(runtimeFactories).toEqual([
			"electron/main/ElectronMainRuntime.ts",
			"src/bridge/game/createGameSessionFx.ts",
			"src/bridge/runtime/RendererRuntime.ts",
		]);
	});

	it("does not create direct Effect.run islands inside active application or tooling source", () => {
		const offenders = activeFiles
			.filter((file) =>
				/\bEffect\.run(?:Promise|PromiseExit|Sync|SyncExit|Fork)\b/.test(
					readFileSync(file, "utf8"),
				),
			)
			.map(projectPath);

		expect(offenders).toEqual([]);
	});

	it("only re-enters one explicitly captured Effect runtime inside the serialized game owner", () => {
		const runtimeRunnerFiles = activeFiles
			.filter((file) =>
				/\bRuntime\.run(?:Promise|PromiseExit|Sync|SyncExit|Fork)\b/.test(
					readFileSync(file, "utf8"),
				),
			)
			.map(projectPath);

		expect(runtimeRunnerFiles).toEqual([
			"src/bridge/game/createGameOwnerFx.ts",
		]);
		const owner = readFileSync("src/bridge/game/createGameOwnerFx.ts", "utf8");
		expect(owner).toContain("yield* Effect.runtime<never>()");
		expect(owner).toContain("Runtime.runPromiseExit(runtime)");
	});

	it("keeps public game lifecycle authority in Effect programs", () => {
		const contract = readFileSync("src/bridge/game/GameSession.ts", "utf8");
		const gameFactory = readFileSync("src/bridge/game/createGameFx.ts", "utf8");
		const sessionFactory = readFileSync("src/bridge/game/createGameSessionFx.ts", "utf8");
		const owner = readFileSync("src/bridge/game/createGameOwnerFx.ts", "utf8");

		expect(contract).toContain("readonly disposeFx: Effect.Effect<void, unknown>");
		expect(contract).toContain("readonly disposeWithoutSaveFx: Effect.Effect<void, unknown>");
		expect(contract).toContain("readonly flushSaveFx: Effect.Effect<void, unknown>");
		expect(contract).not.toMatch(/readonly dispose(?:WithoutSave)?: \(\) => Promise/);
		expect(gameFactory).not.toContain("disposePromise");
		expect(sessionFactory).toContain("Deferred.make<void, unknown>()");
		expect(sessionFactory).toContain("Effect.makeSemaphore(1)");
		expect(owner).toContain("runPromise(releasing.disposeFx)");
	});

	it("keeps the process entrypoints on their one declared runtime boundary", () => {
		const electronEntry = readFileSync("electron/main/index.ts", "utf8");
		const rendererRuntime = readFileSync("src/bridge/runtime/RendererRuntime.ts", "utf8");
		const cliEntry = readFileSync("cli/arkini.ts", "utf8");

		expect(electronEntry).toContain("ElectronMainRuntime.runPromise(electronMainFx())");
		expect(rendererRuntime).toContain("ManagedRuntime.make(Layer.empty)");
		expect(rendererRuntime).toContain("import.meta.hot.data");
		expect(rendererRuntime).toContain("hotData?.rendererRuntime");
		expect(cliEntry).toContain("NodeRuntime.runMain");
	});
});
