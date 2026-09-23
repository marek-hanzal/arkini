import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestOggOpusBytesFn } from "~test/game-config-resource/support/createTestOggOpusBytesFn";
import {
	createProjectTestHarness,
	type ProjectTestHarness,
} from "./support/createProjectTestHarness";

const optimizer = vi.hoisted(() => ({
	callFn: vi.fn(),
}));

vi.mock("~/game-config-resource/fx/optimizeOggOpusResourceFileFx", async () => {
	const { readFile, writeFile } = await import("node:fs/promises");
	const { Effect } = await import("effect");
	return {
		optimizeOggOpusResourceFileFx: Effect.fn("test.optimizeOggOpusResourceFileFx")(
			(source: string, target: string, resourceUid: string) =>
				Effect.tryPromise({
					try: async () => {
						optimizer.callFn(source, target, resourceUid);
						const original = await readFile(source);
						const optimized = Buffer.concat([
							original,
							Buffer.of(0),
						]);
						await writeFile(target, optimized);
						return {
							changed: true,
							originalBytes: original.byteLength,
							optimizedBytes: optimized.byteLength,
							path: target,
						};
					},
					catch: (cause) => cause,
				}),
		),
	};
});

let harness: ProjectTestHarness;

beforeEach(async () => {
	harness = await createProjectTestHarness("serakki-fs-audio-optimize-");
	optimizer.callFn.mockReset();
});

afterEach(async () => harness.close());

describe("filesystem Editor SFX optimization", () => {
	it("rewrites selected SFX through the audio optimizer and rejects another resource type", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		const source = join(harness.temporaryDirectory, "click.ogg");
		const bytes = createTestOggOpusBytesFn();
		await writeFile(source, bytes);
		const imported = await Effect.runPromise(
			repository.upsertResourceFilesFx({
				projectId: project.projectId,
				resources: [
					{
						uid: "click",
						path: source,
						size: bytes.byteLength,
						title: "Test audio",
						type: "sfx",
					},
				],
			}),
		);
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Managed project root missing.");

		const result = await Effect.runPromise(
			repository.optimizeResourcesFx({
				expectedRevision: imported.revision,
				projectId: project.projectId,
				resourceUids: [
					"click",
				],
				type: "sfx",
			}),
		);

		expect(optimizer.callFn).toHaveBeenCalledExactlyOnceWith(
			join(root, "sfx", "click.ogg"),
			expect.stringMatching(/\.ogg$/),
			"click",
		);
		expect(result).toMatchObject({
			optimizedResourceCount: 1,
			originalBytes: bytes.byteLength,
			optimizedBytes: bytes.byteLength + 1,
			processedResourceCount: 1,
		});
		expect(result.project.revision).toBeGreaterThan(imported.revision);
		expect(result.project.resources.find(({ uid }) => uid === "click")).toMatchObject({
			uid: "click",
			title: "Test audio",
		});
		expect(JSON.parse(await readFile(join(root, "sfx", "click.json"), "utf8"))).toEqual({
			title: "Test audio",
		});
		expect(await readFile(join(root, "sfx", "click.ogg"))).toEqual(
			Buffer.concat([
				bytes,
				Buffer.of(0),
			]),
		);

		await expect(
			Effect.runPromise(
				repository.optimizeResourcesFx({
					expectedRevision: result.project.revision,
					projectId: project.projectId,
					resourceUids: [
						"click",
					],
					type: "artwork",
				}),
			),
		).rejects.toThrow("Only artwork resources can be optimized");
	});
});
