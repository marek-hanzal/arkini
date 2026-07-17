export interface RendererDevelopmentUrl {
	readonly href: string;
	readonly origin: string;
	readonly hostname: string;
	readonly port: number;
	readonly webSocketEndpoint: string;
}

const isLoopbackHostname = (hostname: string) =>
	hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]";

export const parseRendererDevelopmentUrl = (value: string): RendererDevelopmentUrl => {
	const parsed = new URL(value);
	if (
		parsed.protocol !== "http:" ||
		parsed.username !== "" ||
		parsed.password !== "" ||
		!isLoopbackHostname(parsed.hostname) ||
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
};

export const RendererDevelopmentServer = parseRendererDevelopmentUrl("http://127.0.0.1:4040/");
