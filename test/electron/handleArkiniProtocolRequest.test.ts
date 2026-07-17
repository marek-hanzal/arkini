import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RendererContentSecurityPolicy } from "../../desktop/security/RendererContentSecurityPolicy";

const netFetch = vi.hoisted(() => vi.fn());

vi.mock("electron", () => ({
	net: {
		fetch: netFetch,
	},
}));

import { handleArkiniProtocolRequestFx } from "../../electron/main/handleArkiniProtocolRequestFx";

let rendererRoot = "";

beforeEach(async () => {
	rendererRoot = await mkdtemp(join(tmpdir(), "arkini-csp-"));
	await writeFile(join(rendererRoot, "index.html"), "<main>Arkini</main>");
	netFetch.mockResolvedValue(
		new Response("<main>Arkini</main>", {
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

describe("handleArkiniProtocolRequestFx", () => {
	it("delivers the restrictive production CSP on packaged renderer responses", async () => {
		const response = await Effect.runPromise(
			handleArkiniProtocolRequestFx({
				request: new Request("arkini://app/"),
				rendererRoot,
			}),
		);

		expect(response.headers.get("Content-Security-Policy")).toBe(
			RendererContentSecurityPolicy.production,
		);
		expect(await response.text()).toBe("<main>Arkini</main>");
	});

	it("keeps CSP on rejected protocol methods", async () => {
		const response = await Effect.runPromise(
			handleArkiniProtocolRequestFx({
				request: new Request("arkini://app/", {
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
});
