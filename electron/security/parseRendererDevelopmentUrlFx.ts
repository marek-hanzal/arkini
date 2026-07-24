import { Effect } from "effect";
import type { RendererDevelopmentUrl } from "./RendererDevelopmentUrl";

/** Parses and constrains one development renderer URL to a loopback HTTP origin. */
export const parseRendererDevelopmentUrlFx = Effect.fn("parseRendererDevelopmentUrlFx")(
	(value: string) =>
		Effect.try({
			try: (): RendererDevelopmentUrl => {
				const parsed = new URL(value);
				if (
					parsed.protocol !== "http:" ||
					parsed.username !== "" ||
					parsed.password !== "" ||
					!(
						parsed.hostname === "127.0.0.1" ||
						parsed.hostname === "localhost" ||
						parsed.hostname === "[::1]"
					) ||
					parsed.pathname !== "/" ||
					parsed.search !== "" ||
					parsed.hash !== ""
				) {
					throw new Error(
						"Electron development renderer must use one credential-free loopback HTTP origin with no path, query, or fragment.",
					);
				}

				const webSocketUrl = new URL(parsed.href);
				webSocketUrl.protocol = "ws:";
				return Object.freeze({
					href: parsed.href,
					origin: parsed.origin,
					hostname: parsed.hostname,
					port: parsed.port === "" ? 80 : Number(parsed.port),
					webSocketEndpoint: webSocketUrl.href,
				});
			},
			catch: (cause) => cause,
		}),
);
