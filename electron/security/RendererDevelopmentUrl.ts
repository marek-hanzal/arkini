export interface RendererDevelopmentUrl {
	readonly href: string;
	readonly origin: string;
	readonly hostname: string;
	readonly port: number;
	readonly webSocketEndpoint: string;
}

export const RendererDevelopmentServer: RendererDevelopmentUrl = Object.freeze({
	href: "http://127.0.0.1:4040/",
	origin: "http://127.0.0.1:4040",
	hostname: "127.0.0.1",
	port: 4040,
	webSocketEndpoint: "ws://127.0.0.1:4040/",
});
