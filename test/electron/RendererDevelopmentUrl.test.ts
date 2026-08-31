import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { RendererDevelopmentServer } from "~electron/security/RendererDevelopmentUrl";
import { parseRendererDevelopmentUrlFx } from "~electron/security/parseRendererDevelopmentUrlFx";

describe("RendererDevelopmentUrl", () => {
	it("derives the exact HTTP and HMR endpoints from one configured URL", () => {
		expect(RendererDevelopmentServer).toEqual({
			href: "http://127.0.0.1:4040/",
			origin: "http://127.0.0.1:4040",
			hostname: "127.0.0.1",
			port: 4040,
			webSocketEndpoint: "ws://127.0.0.1:4040/",
		});
	});

	it("accepts only credential-free loopback HTTP roots", () => {
		expect(Effect.runSync(parseRendererDevelopmentUrlFx("http://localhost:5173/")).origin).toBe(
			"http://localhost:5173",
		);
		expect(Effect.runSync(parseRendererDevelopmentUrlFx("http://[::1]:5173/")).origin).toBe(
			"http://[::1]:5173",
		);

		for (const value of [
			"https://127.0.0.1:4040/",
			"http://192.168.1.50:4040/",
			"http://example.com:4040/",
			"http://user@127.0.0.1:4040/",
			"http://127.0.0.1:4040/game",
			"http://127.0.0.1:4040/?token=x",
			"http://127.0.0.1:4040/#fragment",
		]) {
			expect(() => Effect.runSync(parseRendererDevelopmentUrlFx(value))).toThrow(
				"credential-free loopback HTTP origin",
			);
		}
	});
});
