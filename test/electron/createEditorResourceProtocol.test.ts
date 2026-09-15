import * as NodeServices from "@effect/platform-node/NodeServices";
import { mkdir, mkdtemp, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEditorResourceProtocolFx } from "~electron/main/createEditorResourceProtocolFx";
import { readProjectResourceUrlFn } from "~/project-authoring/fn/readProjectResourceUrlFn";
import { readProjectResourceVersionFn } from "~/project-authoring/filesystem/fn/readProjectResourceVersionFn";

let root = "";
const locations = new Map<
	string,
	{
		root: string;
		path: string;
		version: string;
		size: number;
	}
>();
const reads = vi.fn();
let protocol: createEditorResourceProtocolFx.Output;

const registerFn = async (id: string, content: string) => {
	const path = join(root, "assets", `${id}.png`);
	await writeFile(path, content);
	const info = await stat(path);
	const version = readProjectResourceVersionFn({
		size: info.size,
		mtimeMs: info.mtime.getTime(),
		birthtimeMs: info.birthtime.getTime(),
		dev: info.dev,
		ino: info.ino,
	});
	locations.set(id, {
		root,
		path,
		version,
		size: info.size,
	});
	return readProjectResourceUrlFn({
		projectId: "project",
		resourceId: id,
		version,
	});
};

const requestFn = (url: string, init?: RequestInit) =>
	Effect.runPromise(protocol.handleRequestFx(new Request(url, init)));

beforeEach(async () => {
	root = await realpath(await mkdtemp(join(tmpdir(), "arkini-resource-protocol-")));
	await mkdir(join(root, "assets"));
	reads.mockClear();
	protocol = await Effect.runPromise(
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			return yield* createEditorResourceProtocolFx({
				readResourceLocationFx: ({ projectId, resourceId }) =>
					Effect.succeed(
						projectId === "project" ? (locations.get(resourceId) ?? null) : null,
					),
				isTrustedUrlFn: (url) => url === "arkini://app" || url === "http://127.0.0.1:4040",
				maxCacheBytes: 8,
			}).pipe(
				Effect.provideService(FileSystem.FileSystem, {
					...fs,
					readFile: (path) =>
						fs.readFile(path).pipe(Effect.tap(() => Effect.sync(() => reads(path)))),
				}),
			);
		}).pipe(Effect.provide(NodeServices.layer)),
	);
});

afterEach(async () => {
	locations.clear();
	await rm(root, {
		recursive: true,
		force: true,
	});
});

describe("Editor resource protocol", () => {
	it("loads only requested bytes, deduplicates concurrent requests and serves repeat hits from cache", async () => {
		const url = await registerFn("asset", "abcd");
		await registerFn("unused", "unused");
		expect(reads).not.toHaveBeenCalled();
		expect(
			(
				await requestFn(url, {
					method: "HEAD",
				})
			).status,
		).toBe(200);
		expect(reads).not.toHaveBeenCalled();
		const responses = await Promise.all([
			requestFn(url),
			requestFn(url),
			requestFn(url),
		]);
		expect(await Promise.all(responses.map((response) => response.text()))).toEqual([
			"abcd",
			"abcd",
			"abcd",
		]);
		expect(reads).toHaveBeenCalledTimes(1);
		expect(await (await requestFn(url)).text()).toBe("abcd");
		expect(reads).toHaveBeenCalledTimes(1);
	});

	it("invalidates replaced and removed identities while reading external file changes on demand", async () => {
		const oldUrl = await registerFn("asset", "abcd");
		await requestFn(oldUrl);
		const newUrl = await registerFn("asset", "new");
		expect((await requestFn(oldUrl)).status).toBe(409);
		expect(await (await requestFn(newUrl)).text()).toBe("new");
		await writeFile(join(root, "assets", "asset.png"), "external change");
		const external = await requestFn(newUrl);
		expect(await external.text()).toBe("external change");
		expect(external.headers.get("Content-Length")).toBe("15");
		locations.delete("asset");
		expect((await requestFn(newUrl)).status).toBe(404);
		expect(reads).toHaveBeenCalledTimes(3);
	});

	it("evicts the least recently requested bytes to honor its byte budget", async () => {
		const first = await registerFn("first", "1111");
		const second = await registerFn("second", "2222");
		const third = await registerFn("third", "3333");
		await requestFn(first);
		await requestFn(second);
		await requestFn(first);
		await requestFn(third);
		await requestFn(first);
		expect(reads).toHaveBeenCalledTimes(3);
		await requestFn(second);
		expect(reads).toHaveBeenCalledTimes(4);
	});

	it("rejects unknown identities and resource paths that become symlinks", async () => {
		const url = await registerFn("asset", "abcd");
		expect((await requestFn(url.replace("projectId=project", "projectId=other"))).status).toBe(
			404,
		);
		expect(
			(await requestFn(url.replace("resourceId=asset", "resourceId=..%2Fsecret"))).status,
		).toBe(404);
		const location = locations.get("asset")!;
		await rm(location.path);
		await writeFile(join(root, "private.png"), "private");
		await symlink(join(root, "private.png"), location.path);
		expect((await requestFn(url)).status).toBe(404);
		expect(reads).not.toHaveBeenCalled();
	});

	it("permits trusted renderer image fetches but rejects foreign origins and mutations", async () => {
		const url = await registerFn("asset", "abcd");
		const response = await requestFn(url, {
			headers: {
				Origin: "http://127.0.0.1:4040",
			},
		});
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://127.0.0.1:4040");
		expect(response.headers.get("Content-Type")).toBe("image/png");
		expect(
			(
				await requestFn(url, {
					headers: {
						Origin: "https://foreign.test",
					},
				})
			).status,
		).toBe(403);
		expect(
			(
				await requestFn(url, {
					method: "POST",
				})
			).status,
		).toBe(405);
	});
});
