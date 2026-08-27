import ngrok from "@ngrok/ngrok";
import { Effect, Fiber, Result } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, it } from "@effect/vitest";
import { vi } from "vitest";

import { createNgrokEditorMcpTunnelFx } from "../../../../electron/main/editor-mcp/tunnel/createNgrokEditorMcpTunnelFx";
import { EditorMcpTunnelProvenanceHeader } from "../../../../electron/main/editor-mcp/tunnel/EditorMcpTunnelProvenanceHeader";

const ReconnectGraceMs = 10_000;

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

		const session = await Effect.runPromise(
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
		await Effect.runPromise(session.closeFx);
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

	it.effect("settles listener closure only after the reconnect grace period", () =>
		Effect.gen(function* () {
			const join = vi.fn(() => Promise.reject(new Error("Listener is not joinable")));
			const close = vi.fn();
			vi.mocked(ngrok.forward).mockResolvedValue({
				url: () => "https://stable-example.ngrok-free.app",
				join,
				close,
			} as never);
			const tunnel = yield* createNgrokEditorMcpTunnelFx;
			const session = yield* tunnel.openFx({
				authtoken: "ngrok-token",
				domain: "stable-example.ngrok-free.app",
				port: 32_310,
				provenance: "server-generated-marker",
			});
			const closed = yield* session.closedFx.pipe(Effect.forkChild);
			const options = vi.mocked(ngrok.forward).mock.calls[0]?.[0];
			if (typeof options !== "object") throw new Error("Expected ngrok options.");
			options.onStatusChange?.("closed");
			yield* Effect.yieldNow;
			yield* TestClock.adjust(ReconnectGraceMs - 1);
			expect(closed.pollUnsafe()).toBeUndefined();
			yield* TestClock.adjust(1);

			yield* Fiber.join(closed);
			expect(join).not.toHaveBeenCalled();
			yield* session.closeFx;
			expect(close).toHaveBeenCalledOnce();
		}),
	);

	it.effect("interrupts the stale grace period when ngrok reconnects", () =>
		Effect.gen(function* () {
			const close = vi.fn();
			vi.mocked(ngrok.forward).mockResolvedValue({
				url: () => "https://stable-example.ngrok-free.app",
				join: vi.fn(() => Promise.reject(new Error("Listener is not joinable"))),
				close,
			} as never);
			const tunnel = yield* createNgrokEditorMcpTunnelFx;
			const session = yield* tunnel.openFx({
				authtoken: "ngrok-token",
				domain: "stable-example.ngrok-free.app",
				port: 32_310,
				provenance: "server-generated-marker",
			});
			const closed = yield* session.closedFx.pipe(Effect.forkChild);
			const options = vi.mocked(ngrok.forward).mock.calls[0]?.[0];
			if (typeof options !== "object") throw new Error("Expected ngrok options.");

			options.onStatusChange?.("closed");
			yield* Effect.yieldNow;
			yield* TestClock.adjust(ReconnectGraceMs - 1);
			options.onStatusChange?.("closed");
			yield* Effect.yieldNow;
			yield* TestClock.adjust(ReconnectGraceMs - 1);
			expect(closed.pollUnsafe()).toBeUndefined();
			options.onStatusChange?.("connected");
			yield* Effect.yieldNow;
			yield* TestClock.adjust(1);
			expect(closed.pollUnsafe()).toBeUndefined();
			options.onStatusChange?.("closed");
			yield* Effect.yieldNow;
			yield* TestClock.adjust(ReconnectGraceMs);

			yield* Fiber.join(closed);
			expect(close).not.toHaveBeenCalled();
			yield* session.closeFx;
		}),
	);

	it.effect("interrupts reconnect scheduling before reporting close failures", () =>
		Effect.gen(function* () {
			const closeError = Object.assign(new Error("secret native close failure"), {
				errorCode: "ERR_NGROK_999",
			});
			vi.mocked(ngrok.forward).mockResolvedValue({
				url: () => "https://stable-example.ngrok-free.app",
				join: vi.fn(() => Promise.reject(new Error("Listener is not joinable"))),
				close: vi.fn(() => Promise.reject(closeError)),
			} as never);
			const tunnel = yield* createNgrokEditorMcpTunnelFx;
			const session = yield* tunnel.openFx({
				authtoken: "ngrok-token",
				domain: "stable-example.ngrok-free.app",
				port: 32_310,
				provenance: "server-generated-marker",
			});
			const closed = yield* session.closedFx.pipe(Effect.forkChild);
			const options = vi.mocked(ngrok.forward).mock.calls[0]?.[0];
			if (typeof options !== "object") throw new Error("Expected ngrok options.");
			options.onStatusChange?.("closed");
			yield* Effect.yieldNow;

			const result = yield* session.closeFx.pipe(Effect.result);
			expect(Result.isFailure(result)).toBe(true);
			if (Result.isFailure(result)) {
				expect(result.failure).toEqual(
					new Error("ngrok could not close the Remote MCP tunnel (ERR_NGROK_999)."),
				);
			}
			yield* TestClock.adjust(ReconnectGraceMs);
			expect(closed.pollUnsafe()).toBeUndefined();
			yield* Fiber.interrupt(closed);
		}),
	);
});
