import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RendererContentSecurityPolicy } from "~electron/security/RendererContentSecurityPolicy";

const netFetch = vi.hoisted(() => vi.fn());

vi.mock("electron", () => ({
	net: {
		fetch: netFetch,
	},
}));

import { handleSerakkiProtocolRequestFx } from "~electron/main/handleSerakkiProtocolRequestFx";

let rendererRoot = "";

beforeEach(async () => {
	rendererRoot = await mkdtemp(join(tmpdir(), "serakki-csp-"));
	await writeFile(join(rendererRoot, "index.html"), "<main>Serakki</main>");
	netFetch.mockResolvedValue(
		new Response("<main>Serakki</main>", {
			headers: {
				"Content-Type": "text/html",
			},
		}),
	);
});

afterEach(async () => {
	await rm(rendererRoot, {
		recursive: true,
		force: true,
	});
	netFetch.mockReset();
});

describe("handleSerakkiProtocolRequestFx", () => {
	it("delivers the restrictive production CSP on packaged renderer responses", async () => {
		const response = await Effect.runPromise(
			handleSerakkiProtocolRequestFx({
				request: new Request("serakki://app/"),
				rendererRoot,
			}),
		);

		expect(response.headers.get("Content-Security-Policy")).toBe(
			RendererContentSecurityPolicy.production,
		);
		expect(await response.text()).toBe("<main>Serakki</main>");
	});

	it("keeps CSP on rejected protocol methods", async () => {
		const response = await Effect.runPromise(
			handleSerakkiProtocolRequestFx({
				request: new Request("serakki://app/", {
					method: "POST",
				}),
				rendererRoot,
			}),
		);

		expect(response.status).toBe(405);
		expect(response.headers.get("Content-Security-Policy")).toBe(
			RendererContentSecurityPolicy.production,
		);
	});
	it("routes Editor resource requests to the registered resource owner instead of the renderer tree", async () => {
		const request = new Request(
			"serakki://app/editor/resource?projectId=p&resourceId=r&version=v",
		);
		const handleEditorResourceRequestFx = vi.fn(() => Effect.succeed(new Response("png")));
		const response = await Effect.runPromise(
			handleSerakkiProtocolRequestFx({
				request,
				rendererRoot,
				handleEditorResourceRequestFx,
			}),
		);
		expect(await response.text()).toBe("png");
		expect(handleEditorResourceRequestFx).toHaveBeenCalledWith(request);
		expect(netFetch).not.toHaveBeenCalled();
	});

	it("routes same-origin Game resource requests before the renderer tree", async () => {
		const request = new Request(
			"serakki://app/game/resource?packageId=p&contentHash=h&resourceId=r",
		);
		const handleGameResourceRequestFx = vi.fn(() => Effect.succeed(new Response("png")));
		const response = await Effect.runPromise(
			handleSerakkiProtocolRequestFx({
				request,
				rendererRoot,
				handleGameResourceRequestFx,
			}),
		);
		expect(await response.text()).toBe("png");
		expect(handleGameResourceRequestFx).toHaveBeenCalledWith(request);
		expect(netFetch).not.toHaveBeenCalled();
	});
});
