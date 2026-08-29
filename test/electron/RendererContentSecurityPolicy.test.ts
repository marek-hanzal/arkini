import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { RendererContentSecurityPolicy } from "../../electron/security/RendererContentSecurityPolicy";
import { createRendererDevelopmentContentSecurityPolicyFn } from "../../electron/security/fn/createRendererDevelopmentContentSecurityPolicyFn";
import { parseRendererDevelopmentUrlFx } from "../../electron/security/parseRendererDevelopmentUrlFx";

describe("RendererContentSecurityPolicy", () => {
	it("allows the exact URL-derived HMR endpoint and one Vite development nonce", () => {
		const developmentUrl = Effect.runSync(
			parseRendererDevelopmentUrlFx("http://127.0.0.1:4040/"),
		);
		const policy = createRendererDevelopmentContentSecurityPolicyFn({
			developmentUrl,
			nonce: "arkini-test-nonce",
		});

		expect(policy).toContain("script-src 'self' 'nonce-arkini-test-nonce'");
		expect(policy).toContain("connect-src 'self' blob: data: ws://127.0.0.1:4040/");
		expect(policy).not.toContain("unsafe-eval");
		expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
		expect(policy).not.toContain("ws://localhost:4040");
		expect(policy).not.toContain("ws://127.0.0.1:4041");
	});

	it("keeps the packaged policy independent from development transport", () => {
		expect(RendererContentSecurityPolicy.production).toContain("script-src 'self'");
		expect(RendererContentSecurityPolicy.production).toContain(
			"connect-src 'self' blob: data:",
		);
		expect(RendererContentSecurityPolicy.production).not.toContain("nonce-");
		expect(RendererContentSecurityPolicy.production).not.toContain("ws:");
		expect(RendererContentSecurityPolicy.production).not.toContain("unsafe-eval");
	});
});
