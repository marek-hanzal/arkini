import ngrok from "@ngrok/ngrok";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { createNgrokEditorMcpTunnelFx } from "../../../../electron/main/editor-mcp/tunnel/createNgrokEditorMcpTunnelFx";
import { EditorMcpTunnelProvenanceHeader } from "../../../../electron/main/editor-mcp/tunnel/EditorMcpTunnelProvenanceHeader";

vi.mock("@ngrok/ngrok", () => ({
	default: {
		forward: vi.fn(),
	},
}));

describe("createNgrokEditorMcpTunnelFx", () => {
	it("replaces any caller-supplied provenance header at the ngrok edge", async () => {
		vi.mocked(ngrok.forward).mockResolvedValue({
			url: () => "https://stable-example.ngrok-free.app",
			join: vi.fn(() => new Promise<void>(() => undefined)),
			close: vi.fn(),
		} as never);
		const tunnel = Effect.runSync(createNgrokEditorMcpTunnelFx);

		await Effect.runPromise(
			tunnel.openFx({
				authtoken: "ngrok-token",
				port: 32_310,
				provenance: "server-generated-marker",
			}),
		);

		expect(ngrok.forward).toHaveBeenCalledWith(
			expect.objectContaining({
				request_header_remove: [
					EditorMcpTunnelProvenanceHeader,
				],
				request_header_add: [
					`${EditorMcpTunnelProvenanceHeader}:server-generated-marker`,
				],
			}),
		);
	});

	it("does not expose a rejected authtoken through the tunnel error", async () => {
		const authtoken = "canary-secret-ngrok-token";
		vi.mocked(ngrok.forward).mockRejectedValue(new Error(`Your authtoken: ${authtoken}`));
		const tunnel = Effect.runSync(createNgrokEditorMcpTunnelFx);

		const failure = await Effect.runPromise(
			Effect.flip(
				tunnel.openFx({
					authtoken,
					port: 32_310,
					provenance: "server-generated-marker",
				}),
			),
		);

		expect(failure).toBeInstanceOf(Error);
		if (!(failure instanceof Error)) throw new Error("Expected the tunnel to fail.");
		expect(failure.message).toBe("ngrok could not open the Remote MCP tunnel.");
		expect(failure.message).not.toContain(authtoken);
	});

	it("does not expose the authtoken through a later tunnel failure", async () => {
		const authtoken = "canary-secret-ngrok-token";
		vi.mocked(ngrok.forward).mockResolvedValue({
			url: () => "https://stable-example.ngrok-free.app",
			join: vi.fn(() => Promise.reject(new Error(`Your authtoken: ${authtoken}`))),
			close: vi.fn(),
		} as never);
		const tunnel = Effect.runSync(createNgrokEditorMcpTunnelFx);
		const session = await Effect.runPromise(
			tunnel.openFx({
				authtoken,
				port: 32_310,
				provenance: "server-generated-marker",
			}),
		);

		const failure = await Effect.runPromise(Effect.flip(session.joinFx));

		expect(failure).toBeInstanceOf(Error);
		if (!(failure instanceof Error)) throw new Error("Expected the tunnel to fail.");
		expect(failure.message).toBe("ngrok Remote MCP tunnel stopped unexpectedly.");
		expect(failure.message).not.toContain(authtoken);
	});
});
