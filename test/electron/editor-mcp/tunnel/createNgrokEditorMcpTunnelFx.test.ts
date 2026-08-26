import ngrok from "@ngrok/ngrok";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createNgrokEditorMcpTunnelFx } from "../../../../electron/main/editor-mcp/tunnel/createNgrokEditorMcpTunnelFx";
import { EditorMcpTunnelProvenanceHeader } from "../../../../electron/main/editor-mcp/tunnel/EditorMcpTunnelProvenanceHeader";

vi.mock("@ngrok/ngrok", () => ({
	default: {
		forward: vi.fn(),
	},
}));

afterEach(() => {
	vi.useRealTimers();
});

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
				domain: "stable-example.ngrok-free.app",
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
				domain: "stable-example.ngrok-free.app",
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
					domain: "stable-example.ngrok-free.app",
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

	it("observes listener closure without joining an auto-forwarding listener", async () => {
		vi.useFakeTimers();
		const join = vi.fn(() => Promise.reject(new Error("Listener is not joinable")));
		vi.mocked(ngrok.forward).mockResolvedValue({
			url: () => "https://stable-example.ngrok-free.app",
			join,
			close: vi.fn(),
		} as never);
		const tunnel = Effect.runSync(createNgrokEditorMcpTunnelFx);
		const session = await Effect.runPromise(
			tunnel.openFx({
				authtoken: "ngrok-token",
				domain: "stable-example.ngrok-free.app",
				port: 32_310,
				provenance: "server-generated-marker",
			}),
		);
		const closed = Effect.runPromise(session.closedFx);
		const options = vi.mocked(ngrok.forward).mock.calls[0]?.[0];
		if (typeof options !== "object") throw new Error("Expected ngrok options.");
		options.onStatusChange?.("closed");
		await vi.runAllTimersAsync();

		await expect(closed).resolves.toBeUndefined();
		expect(join).not.toHaveBeenCalled();
	});

	it("keeps an auto-forwarding listener alive when ngrok reconnects", async () => {
		vi.useFakeTimers();
		const close = vi.fn();
		vi.mocked(ngrok.forward).mockResolvedValue({
			url: () => "https://stable-example.ngrok-free.app",
			join: vi.fn(() => Promise.reject(new Error("Listener is not joinable"))),
			close,
		} as never);
		const tunnel = Effect.runSync(createNgrokEditorMcpTunnelFx);
		const session = await Effect.runPromise(
			tunnel.openFx({
				authtoken: "ngrok-token",
				domain: "stable-example.ngrok-free.app",
				port: 32_310,
				provenance: "server-generated-marker",
			}),
		);
		let publishedClosed = false;
		void Effect.runPromise(session.closedFx).then(() => {
			publishedClosed = true;
		});
		const options = vi.mocked(ngrok.forward).mock.calls[0]?.[0];
		if (typeof options !== "object") throw new Error("Expected ngrok options.");

		options.onStatusChange?.("closed");
		options.onStatusChange?.("connected");
		await vi.runAllTimersAsync();

		expect(publishedClosed).toBe(false);
		expect(close).not.toHaveBeenCalled();
		await Effect.runPromise(session.closeFx);
	});
});
