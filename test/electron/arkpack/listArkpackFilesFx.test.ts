import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem } from "effect";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { listArkpackFilesFx } from "~electron/main/arkpack/listArkpackFilesFx";
import { createTestArkpack } from "~test/arkpack-support/fx/createTestArkpack";

let root = "";

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "arkini-arkpack-list-"));
	await mkdir(root, {
		recursive: true,
	});
});

afterEach(async () => {
	await rm(root, {
		force: true,
		recursive: true,
	});
});

describe("listArkpackFilesFx", () => {
	it("bounds the total package bytes retained by one root scan", async () => {
		const first = createTestArkpack(undefined, "first");
		const second = createTestArkpack(undefined, "second");
		await Promise.all([
			writeFile(join(root, "first.arkpack"), first),
			writeFile(join(root, "second.arkpack"), second),
		]);
		const fileSystem = await Effect.runPromise(
			FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer)),
		);

		const files = await Effect.runPromise(
			listArkpackFilesFx({
				root,
				fileSystem,
				maxTotalBytes: first.byteLength,
				source: "user",
			}),
		);

		expect(files.map(({ packageId }) => packageId)).toEqual([
			"first",
		]);
	});

	it("bounds candidates independently from the byte budget", async () => {
		await Promise.all([
			writeFile(join(root, "first.arkpack"), createTestArkpack(undefined, "first")),
			writeFile(join(root, "second.arkpack"), createTestArkpack(undefined, "second")),
		]);
		const fileSystem = await Effect.runPromise(
			FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer)),
		);

		const files = await Effect.runPromise(
			listArkpackFilesFx({
				root,
				fileSystem,
				maxCandidates: 1,
				source: "user",
			}),
		);

		expect(files.map(({ packageId }) => packageId)).toEqual([
			"first",
		]);
	});

	it("counts rejected canonical candidates against the scan limit", async () => {
		await Promise.all([
			writeFile(
				join(root, "first.arkpack"),
				new Uint8Array([
					1,
				]),
			),
			writeFile(
				join(root, "second.arkpack"),
				new Uint8Array([
					2,
				]),
			),
		]);
		const fileSystem = await Effect.runPromise(
			FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer)),
		);

		await expect(
			Effect.runPromise(
				listArkpackFilesFx({
					root,
					fileSystem,
					maxCandidates: 1,
					maxTotalBytes: 0,
					source: "user",
				}),
			),
		).resolves.toEqual([]);
	});
});
