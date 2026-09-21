import { Clock, FileSystem } from "effect";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Deferred, Effect, Fiber, Option } from "effect";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFilesystemGameSaveFilesFx } from "~/game-persistence/fx/createFilesystemGameSaveFilesFx";
import { encodeGameProjectFileStemFn } from "~/game-config-source/fn/encodeGameProjectFileStemFn";

let root = "";
const first = {
	packageId: "serakki",
};
const second = {
	packageId: "second",
};
const demo = {
	packageId: "demo",
};

const createRepository = (fileSystem?: FileSystem.FileSystem) =>
	Effect.runPromise(
		createFilesystemGameSaveFilesFx({
			root: join(root, "serakki", "game", "saves"),
			fileSystem,
		}).pipe(Effect.provide(NodeServices.layer)),
	);

const readNodeFileSystem = () =>
	Effect.runPromise(FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer)));

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "serakki-saves-"));
});
afterEach(async () => {
	await rm(root, {
		recursive: true,
		force: true,
	});
});

describe("createFilesystemGameSaveFilesFx", () => {
	it("writes package saves through pending/current replacement and isolates clear", async () => {
		const repository = await createRepository();
		await Effect.runPromise(
			repository.writeFx(
				first,
				new Uint8Array([
					1,
					2,
				]),
			),
		);
		await Effect.runPromise(
			repository.writeFx(
				second,
				new Uint8Array([
					3,
					4,
				]),
			),
		);
		expect(await Effect.runPromise(repository.readFx(first))).toEqual(
			new Uint8Array([
				1,
				2,
			]),
		);
		expect(await Effect.runPromise(repository.readFx(second))).toEqual(
			new Uint8Array([
				3,
				4,
			]),
		);
		await Effect.runPromise(repository.clearFx(first));
		expect(await Effect.runPromise(repository.readFx(first))).toBeNull();
		expect(await Effect.runPromise(repository.readFx(second))).toEqual(
			new Uint8Array([
				3,
				4,
			]),
		);
	});

	it("persists saves for safe stable built-in package identities", async () => {
		const repository = await createRepository();
		const bytes = new Uint8Array([
			7,
			8,
			9,
		]);

		await Effect.runPromise(repository.writeFx(demo, bytes));
		expect(await Effect.runPromise(repository.readFx(demo))).toEqual(bytes);
		expect(
			new Uint8Array(
				await readFile(
					join(root, "serakki", "game", "saves", demo.packageId, "current.serasave"),
				),
			),
		).toEqual(bytes);
		await Effect.runPromise(repository.clearFx(demo));
		expect(await Effect.runPromise(repository.readFx(demo))).toBeNull();
	});

	it("orders clear after an already admitted write", async () => {
		const fileSystem = await readNodeFileSystem();
		const writeEntered = Effect.runSync(Deferred.make<void>());
		const releaseWrite = Effect.runSync(Deferred.make<void>());
		const clearEntered = Effect.runSync(Deferred.make<void>());
		const saveDirectory = join(root, "serakki", "game", "saves", first.packageId);
		const gatedFileSystem: FileSystem.FileSystem = {
			...fileSystem,
			writeFile: (target, bytes, options) =>
				Deferred.succeed(writeEntered, undefined).pipe(
					Effect.andThen(Deferred.await(releaseWrite)),
					Effect.andThen(fileSystem.writeFile(target, bytes, options)),
				),
			remove: (path, options) =>
				String(path) === saveDirectory
					? Deferred.succeed(clearEntered, undefined).pipe(
							Effect.andThen(fileSystem.remove(path, options)),
						)
					: fileSystem.remove(path, options),
		};
		const repository = await createRepository(gatedFileSystem);
		const write = Effect.runPromise(
			repository.writeFx(
				first,
				new Uint8Array([
					1,
				]),
			),
		);
		await Effect.runPromise(Deferred.await(writeEntered));

		const clear = Effect.runPromise(repository.clearFx(first));
		expect(Option.isNone(await Effect.runPromise(Deferred.poll(clearEntered)))).toBe(true);

		Effect.runSync(Deferred.succeed(releaseWrite, undefined));
		await Promise.all([
			write,
			clear,
		]);
		expect(await Effect.runPromise(repository.readFx(first))).toBeNull();
	});

	it("replaces the complete current file and encodes every canonical package identity", async () => {
		const repository = await createRepository();
		await Effect.runPromise(
			repository.writeFx(
				first,
				new Uint8Array([
					1,
					2,
					3,
					4,
				]),
			),
		);
		await Effect.runPromise(
			repository.writeFx(
				first,
				new Uint8Array([
					9,
				]),
			),
		);
		const path = join(root, "serakki", "game", "saves", "serakki", "current.serasave");
		expect(new Uint8Array(await readFile(path))).toEqual(
			new Uint8Array([
				9,
			]),
		);
		const encoded = {
			packageId: "studio:game/one",
		};
		await Effect.runPromise(
			repository.writeFx(
				encoded,
				new Uint8Array([
					5,
				]),
			),
		);
		expect(await Effect.runPromise(repository.readFx(encoded))).toEqual(
			new Uint8Array([
				5,
			]),
		);
		await expect(
			access(
				join(
					root,
					"serakki",
					"game",
					"saves",
					encodeGameProjectFileStemFn(encoded.packageId),
					"current.serasave",
				),
			),
		).resolves.toBeUndefined();
		await expect(
			Effect.runPromise(
				repository.writeFx(
					{
						packageId: "",
					},
					new Uint8Array([
						6,
					]),
				),
			),
		).rejects.toMatchObject({
			_tag: "GameSaveFilesError",
			operation: "Invalid Serakki save identity",
		});
	});
});

const at = <A, E>(now: number, effect: Effect.Effect<A, E>) =>
	Effect.runPromise(
		Effect.gen(function* () {
			const clock = yield* Clock.Clock;
			return yield* effect.pipe(
				Effect.provideService(Clock.Clock, {
					monotonicTimeNanos: clock.monotonicTimeNanos,
					monotonicTimeNanosUnsafe: () => clock.monotonicTimeNanosUnsafe(),
					currentTimeNanos: clock.currentTimeNanos,
					currentTimeNanosUnsafe: () => clock.currentTimeNanosUnsafe(),
					sleep: (duration) => clock.sleep(duration),
					currentTimeMillis: Effect.succeed(now),
					currentTimeMillisUnsafe: () => now,
				}),
			);
		}),
	);

it("retains independent interval snapshots across restart and long downtime", async () => {
	let saves = await createRepository();
	const start = 1_700_000_000_000;
	const write = (elapsed: number, value: number) =>
		at(start + elapsed, saves.writeFx(first, Uint8Array.of(value)));
	await write(0, 1);
	await write(299_999, 2);
	expect(await Effect.runPromise(saves.readFx(first, "5-min"))).toEqual(Uint8Array.of(1));
	await write(300_000, 3);
	expect(await Effect.runPromise(saves.readFx(first, "5-min"))).toEqual(Uint8Array.of(3));
	expect(await Effect.runPromise(saves.readFx(first, "30-min"))).toEqual(Uint8Array.of(1));
	saves = await createRepository();
	await write(1_799_999, 4);
	expect(await Effect.runPromise(saves.readFx(first, "30-min"))).toEqual(Uint8Array.of(1));
	await write(1_800_000, 5);
	expect(await Effect.runPromise(saves.readFx(first, "30-min"))).toEqual(Uint8Array.of(5));
	expect(await Effect.runPromise(saves.readFx(first, "4-hour"))).toEqual(Uint8Array.of(1));
	await write(14_399_999, 6);
	expect(await Effect.runPromise(saves.readFx(first, "4-hour"))).toEqual(Uint8Array.of(1));
	await write(14_400_000, 7);
	expect(await Effect.runPromise(saves.readFx(first, "4-hour"))).toEqual(Uint8Array.of(7));
	await write(100_000_000, 8);
	const slots = await Effect.runPromise(saves.listFx(first));
	expect(slots.filter((entry) => entry.slot !== "manual").map((entry) => entry.savedAt)).toEqual(
		Array(4).fill(start + 100_000_000),
	);
});

it("keeps manual and restore separate from rotation and clears the complete save set", async () => {
	const saves = await createRepository();
	expect(
		(await Effect.runPromise(saves.listFx(first))).every((entry) => entry.savedAt === null),
	).toBe(true);
	await at(1000, saves.writeFx(first, Uint8Array.of(1)));
	await at(2000, saves.writeFx(first, Uint8Array.of(2), "manual"));
	expect(await Effect.runPromise(saves.readFx(first))).toEqual(Uint8Array.of(1));
	const before = await Effect.runPromise(saves.listFx(first));
	await at(30_000_000, saves.restoreFx(first, Uint8Array.of(2)));
	expect(await Effect.runPromise(saves.readFx(first))).toEqual(Uint8Array.of(2));
	expect((await Effect.runPromise(saves.listFx(first))).slice(1)).toEqual(before.slice(1));
	await Effect.runPromise(saves.clearFx(first));
	expect(
		(await Effect.runPromise(saves.listFx(first))).every((entry) => entry.savedAt === null),
	).toBe(true);
});

it("preserves failed checkpoint bytes and timestamp and retries the due slot", async () => {
	const fs = await readNodeFileSystem();
	let fail = false;
	const saves = await createRepository({
		...fs,
		rename: (from, to) =>
			fail && to.endsWith("5-min.serasave")
				? Effect.fail({
						message: "rename failed",
					} as never)
				: fs.rename(from, to),
	});
	await at(1000, saves.writeFx(first, Uint8Array.of(1)));
	fail = true;
	await expect(at(301000, saves.writeFx(first, Uint8Array.of(2)))).rejects.toMatchObject({
		_tag: "GameSaveFilesError",
	});
	expect(await Effect.runPromise(saves.readFx(first, "5-min"))).toEqual(Uint8Array.of(1));
	expect(
		(await Effect.runPromise(saves.listFx(first))).find((entry) => entry.slot === "5-min")
			?.savedAt,
	).toBe(1000);
	fail = false;
	await at(301001, saves.writeFx(first, Uint8Array.of(3)));
	expect(await Effect.runPromise(saves.readFx(first, "5-min"))).toEqual(Uint8Array.of(3));
});

it("a partial temporary write cannot damage the current save", async () => {
	const fs = await readNodeFileSystem();
	let fail = false;
	const saves = await createRepository({
		...fs,
		writeFile: (path, bytes, options) =>
			fail
				? fs.writeFile(path, Uint8Array.of(9)).pipe(
						Effect.andThen(
							Effect.fail({
								message: "disk full",
							} as never),
						),
					)
				: fs.writeFile(path, bytes, options),
	});
	await at(1000, saves.writeFx(first, Uint8Array.of(1, 2, 3)));
	fail = true;
	await expect(at(301000, saves.writeFx(first, Uint8Array.of(4)))).rejects.toMatchObject({
		_tag: "GameSaveFilesError",
	});
	expect(await Effect.runPromise(saves.readFx(first))).toEqual(Uint8Array.of(1, 2, 3));
	expect((await Effect.runPromise(saves.listFx(first)))[0]?.savedAt).toBe(1000);
	expect(await Effect.runPromise(saves.readFx(first, "5-min"))).toEqual(Uint8Array.of(1, 2, 3));
});

it("interruption before publication preserves the old slot and allows the next write", async () => {
	const fs = await readNodeFileSystem();
	const entered = Effect.runSync(Deferred.make<void>());
	let interrupt = false;
	const saves = await createRepository({
		...fs,
		utimes: (path, atime, mtime) =>
			interrupt
				? Deferred.succeed(entered, undefined).pipe(Effect.andThen(Effect.never))
				: fs.utimes(path, atime, mtime),
	});
	await at(1000, saves.writeFx(first, Uint8Array.of(1)));
	interrupt = true;
	const fiber = Effect.runFork(saves.writeFx(first, Uint8Array.of(2)));
	await Effect.runPromise(Deferred.await(entered));
	await Effect.runPromise(Fiber.interrupt(fiber));
	expect(await Effect.runPromise(saves.readFx(first))).toEqual(Uint8Array.of(1));
	interrupt = false;
	await at(2000, saves.writeFx(first, Uint8Array.of(3)));
	expect(await Effect.runPromise(saves.readFx(first))).toEqual(Uint8Array.of(3));
});

it("serializes manual save behind an admitted autosave without changing checkpoints", async () => {
	const fs = await readNodeFileSystem();
	const entered = Effect.runSync(Deferred.make<void>());
	const release = Effect.runSync(Deferred.make<void>());
	const order: string[] = [];
	const saves = await createRepository({
		...fs,
		writeFile: (path, bytes, options) =>
			Effect.gen(function* () {
				order.push(path);
				if (path.endsWith("current.serasave.pending")) {
					yield* Deferred.succeed(entered, undefined);
					yield* Deferred.await(release);
				}
				yield* fs.writeFile(path, bytes, options);
			}),
	});
	const auto = Effect.runPromise(saves.writeFx(first, Uint8Array.of(1)));
	await Effect.runPromise(Deferred.await(entered));
	const manual = Effect.runPromise(saves.writeFx(first, Uint8Array.of(2), "manual"));
	expect(order).toHaveLength(1);
	Effect.runSync(Deferred.succeed(release, undefined));
	await Promise.all([
		auto,
		manual,
	]);
	expect(order.at(-1)).toContain("manual.serasave.pending");
	expect(await Effect.runPromise(saves.readFx(first, "5-min"))).toEqual(Uint8Array.of(1));
	expect(await Effect.runPromise(saves.readFx(first, "manual"))).toEqual(Uint8Array.of(2));
});
