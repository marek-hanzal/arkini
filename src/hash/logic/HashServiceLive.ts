import type { HashService } from "~/hash/context/HashServiceFx";
import type { GameConfig } from "~/manifest/data/GameConfig";

function normalizeGameConfig(config: GameConfig) {
	return JSON.stringify(config, (_key, value: unknown) => {
		if (typeof value === "string" && value.startsWith("blob:")) return "[blob-url]";
		return value;
	});
}

async function sha256(input: string | Uint8Array) {
	const encoded = typeof input === "string" ? new TextEncoder().encode(input) : input;
	const buffer = encoded.buffer.slice(
		encoded.byteOffset,
		encoded.byteOffset + encoded.byteLength,
	) as ArrayBuffer;
	const digest = await crypto.subtle.digest("SHA-256", buffer);

	return [
		...new Uint8Array(digest),
	]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

export const HashServiceLive: HashService = {
	sha256,
	gameConfig(config) {
		return sha256(normalizeGameConfig(config));
	},
};
