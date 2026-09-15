import * as NodeServices from "@effect/platform-node/NodeServices";
import { mkdir, mkdtemp, readFile, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const netFetch = vi.hoisted(() => vi.fn());

vi.mock("electron", () => ({
	net: {
		fetch: netFetch,
	},
}));

import { createEditorResourceProtocolFx } from "~electron/main/createEditorResourceProtocolFx";
import { readProjectResourceUrlFn } from "~/project-authoring/fn/readProjectResourceUrlFn";
import { readProjectResourceVersionFn } from "~/project-authoring/filesystem/fn/readProjectResourceVersionFn";

let root = "";
const locations = new Map<
	string,
	{
		root: string;
		path: string;
		type: "artwork" | "music";
		version: string;
		size: number;
	}
>();
let protocol: createEditorResourceProtocolFx.Output;
let nativeBodies: Array<ReadableStream<Uint8Array> | null> = [];

const registerFn = async (id: string, content: string, type: "artwork" | "music" = "artwork") => {
	const path = join(root, type, `${id}.${type === "music" ? "ogg" : "png"}`);
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
		type,
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
	await mkdir(join(root, "artwork"));
	await mkdir(join(root, "music"));
	netFetch.mockReset();
	nativeBodies = [];
	netFetch.mockImplementation(async (url: string, init?: RequestInit) => {
		const bytes = Uint8Array.from(await readFile(fileURLToPath(url)));
		const body =
			init?.method === "HEAD"
				? null
				: new ReadableStream<Uint8Array>({
						start(controller) {
							controller.enqueue(bytes);
							controller.close();
						},
					});
		nativeBodies.push(body);
		return {
			body,
			headers: new Headers({
				"Content-Length": String(bytes.byteLength),
			}),
			status: 200,
		} as unknown as Response;
	});
	protocol = await Effect.runPromise(
		createEditorResourceProtocolFx({
			readResourceLocationFx: ({ projectId, resourceId }) =>
				Effect.succeed(
					projectId === "project" ? (locations.get(resourceId) ?? null) : null,
				),
			isTrustedUrlFn: (url) => url === "arkini://app" || url === "http://127.0.0.1:4040",
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
	it("streams only requested files without retaining their response bodies", async () => {
		const url = await registerFn("asset", "abcd");
		await registerFn("unused", "unused");
		expect(netFetch).not.toHaveBeenCalled();
		expect(
			(
				await requestFn(url, {
					method: "HEAD",
				})
			).status,
		).toBe(200);
		expect(netFetch).toHaveBeenCalledTimes(1);
		const response = await requestFn(url);
		expect(response.body).toBe(nativeBodies[1]);
		expect(nativeBodies[1]?.locked).toBe(false);
		expect(await response.text()).toBe("abcd");
		expect(netFetch).toHaveBeenCalledTimes(2);
		expect(await (await requestFn(url)).text()).toBe("abcd");
		expect(netFetch).toHaveBeenCalledTimes(3);
		expect(netFetch.mock.calls.every(([fileUrl]) => !String(fileUrl).includes("unused"))).toBe(
			true,
		);
	});

	it("invalidates replaced and removed identities while reading external file changes on demand", async () => {
		const oldUrl = await registerFn("asset", "abcd");
		await requestFn(oldUrl);
		const newUrl = await registerFn("asset", "new");
		expect((await requestFn(oldUrl)).status).toBe(409);
		expect(await (await requestFn(newUrl)).text()).toBe("new");
		await writeFile(join(root, "artwork", "asset.png"), "external change");
		const external = await requestFn(newUrl);
		expect(await external.text()).toBe("external change");
		expect(external.headers.get("Content-Length")).toBe("15");
		locations.delete("asset");
		expect((await requestFn(newUrl)).status).toBe(404);
		expect(netFetch).toHaveBeenCalledTimes(3);
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
		expect(netFetch).not.toHaveBeenCalled();
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

	it("serves Music as Ogg audio and forwards media byte ranges", async () => {
		const url = await registerFn("theme", "abcdef", "music");
		netFetch.mockResolvedValueOnce(
			new Response("cd", {
				status: 200,
			}),
		);

		const response = await requestFn(url, {
			headers: {
				Range: "bytes=2-3",
			},
		});

		expect(response.status).toBe(206);
		expect(response.headers.get("Accept-Ranges")).toBe("bytes");
		expect(response.headers.get("Content-Length")).toBe("2");
		expect(response.headers.get("Content-Type")).toBe("audio/ogg");
		expect(response.headers.get("Content-Range")).toBe("bytes 2-3/6");
		expect(netFetch).toHaveBeenCalledWith(expect.any(String), {
			headers: {
				Range: "bytes=2-3",
			},
			method: "GET",
		});
	});
});
