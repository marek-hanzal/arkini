import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem } from "effect";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { listArkpackFilesFx } from "../../electron/main/arkpack/listArkpackFilesFx";
import { ArkpackLimits } from "../../shared/ArkpackLimits";

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
		await Promise.all([
			writeFile(
				join(root, "first.arkpack"),
				new Uint8Array([
					1,
					2,
					3,
				]),
			),
			writeFile(
				join(root, "second.arkpack"),
				new Uint8Array([
					4,
					5,
					6,
				]),
			),
		]);
		const fileSystem = await Effect.runPromise(
			FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer)),
		);

		const files = await Effect.runPromise(
			listArkpackFilesFx({
				root,
				fileSystem,
				maxTotalBytes: 3,
				source: "user",
			}),
		);

		expect(files.map(({ packageId }) => packageId)).toEqual([
			"first",
		]);
	});

	it("bounds zero-byte candidates independently from the byte budget", async () => {
		await Promise.all([
			writeFile(join(root, "first.arkpack"), new Uint8Array()),
			writeFile(join(root, "second.arkpack"), new Uint8Array()),
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

	it("charges detached signatures to the root byte budget", async () => {
		const path = join(root, "signed.arkpack");
		await Promise.all([
			writeFile(
				path,
				new Uint8Array([
					1,
				]),
			),
			writeFile(join(root, "signed.arksig"), "sig"),
		]);
		const fileSystem = await Effect.runPromise(
			FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer)),
		);

		await expect(
			Effect.runPromise(
				listArkpackFilesFx({
					root,
					fileSystem,
					maxTotalBytes: 3,
					source: "user",
				}),
			),
		).resolves.toEqual([]);
	});

	it("ignores an oversized bundle instead of hiding its playable Arkpack", async () => {
		await Promise.all([
			writeFile(join(root, "external.arkpack"), Uint8Array.of(1)),
			writeFile(
				join(root, "external.arksig"),
				new Uint8Array(ArkpackLimits.maxSignatureBytes + 1),
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
					maxTotalBytes: 1,
					source: "user",
				}),
			),
		).resolves.toEqual([
			expect.objectContaining({
				packageId: "external",
				trust: {
					type: "external",
				},
			}),
		]);
	});
});
