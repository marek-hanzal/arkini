import { Effect } from "effect";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const netFetch = vi.hoisted(() => vi.fn());

vi.mock("electron", () => ({
	net: {
		fetch: netFetch,
	},
}));

import { createGameResourceProtocolFx } from "~electron/main/createGameResourceProtocolFx";
import { encodeGameProjectFileStemFn } from "~/game-config-source/fn/encodeGameProjectFileStemFn";

let root = "";

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "arkini-game-resource-"));
	netFetch.mockReset();
});

afterEach(async () => {
	await rm(root, {
		force: true,
		recursive: true,
	});
});

describe("Game resource protocol", () => {
	it("serves one installed file lazily and forwards media byte ranges", async () => {
		const packageId = "package:image";
		const contentHash = "a".repeat(64);
		const installationRoot = join(
			root,
			encodeGameProjectFileStemFn(packageId).replaceAll("%2E", "."),
			contentHash,
		);
		await mkdir(join(installationRoot, "resources"), {
			recursive: true,
		});
		await writeFile(join(installationRoot, "resources", "000000"), "abcdef");
		await writeFile(
			join(installationRoot, "installation.json"),
			JSON.stringify({
				packageId,
				contentHash,
				resources: [
					{
						id: "image:hero",
						type: "image",
						path: "resources/000000",
						size: 6,
					},
				],
			}),
		);
		netFetch.mockResolvedValue(
			new Response("bc", {
				status: 206,
				headers: {
					"Content-Length": "2",
					"Content-Range": "bytes 1-2/6",
				},
			}),
		);
		const protocol = await Effect.runPromise(
			createGameResourceProtocolFx({
				installationsRoot: root,
				isTrustedUrlFn: () => true,
			}),
		);
		const url = `arkini://app/game/resource?packageId=${encodeURIComponent(packageId)}&contentHash=${contentHash}&resourceId=${encodeURIComponent("image:hero")}`;

		const response = await Effect.runPromise(
			protocol.handleRequestFx(
				new Request(url, {
					headers: {
						Origin: "arkini://app",
						Range: "bytes=1-2",
					},
				}),
			),
		);

		expect(response.status).toBe(206);
		expect(response.headers.get("Content-Range")).toBe("bytes 1-2/6");
		expect(response.headers.get("Content-Length")).toBe("2");
		expect(response.headers.get("Content-Type")).toBe("image/png");
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe("arkini://app");
		expect(response.headers.get("Vary")).toBe("Origin");
		expect(await response.text()).toBe("bc");
		expect(netFetch).toHaveBeenCalledWith(
			expect.stringMatching(/^file:/),
			expect.objectContaining({
				headers: {
					Range: "bytes=1-2",
				},
			}),
		);
	});
});
