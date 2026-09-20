import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem } from "effect";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { listSerapackFilesFx } from "~electron/main/serapack/listSerapackFilesFx";
import { createTestSerapack } from "~test/serapack-support/fx/createTestSerapack";

let root = "";

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "serakki-serapack-list-"));
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

describe("listSerapackFilesFx", () => {
	it("bounds the total package bytes retained by one root scan", async () => {
		const first = createTestSerapack(undefined, "first");
		const second = createTestSerapack(undefined, "second");
		await Promise.all([
			writeFile(join(root, "first.serapack"), first),
			writeFile(join(root, "second.serapack"), second),
		]);
		const fileSystem = await Effect.runPromise(
			FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer)),
		);

		const files = await Effect.runPromise(
			listSerapackFilesFx({
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
			writeFile(join(root, "first.serapack"), createTestSerapack(undefined, "first")),
			writeFile(join(root, "second.serapack"), createTestSerapack(undefined, "second")),
		]);
		const fileSystem = await Effect.runPromise(
			FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer)),
		);

		const files = await Effect.runPromise(
			listSerapackFilesFx({
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
				join(root, "first.serapack"),
				new Uint8Array([
					1,
				]),
			),
			writeFile(
				join(root, "second.serapack"),
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
				listSerapackFilesFx({
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
