import type { GameConfig } from "~/config/GameConfigTypes";
import { parseGameConfig } from "~/config/GameConfigSchema";
import { decodeArkiniPack, type ArkiniPackResourcePayload } from "~/config/pack/ArkiniPackFormat";

export interface CreateGameConfigFromArkiniPackOptions {
	createResourceData?(resource: ArkiniPackResourcePayload): string;
}

const createBase64ResourceData = (resource: ArkiniPackResourcePayload) =>
	resource.mime === "image/png"
		? bytesToBase64(resource.bytes)
		: `data:${resource.mime};base64,${bytesToBase64(resource.bytes)}`;

export const createGameConfigFromArkiniPack = (
	bytes: Uint8Array,
	options: CreateGameConfigFromArkiniPackOptions = {},
): GameConfig => {
	const pack = decodeArkiniPack(bytes);
	const createResourceData = options.createResourceData ?? createBase64ResourceData;
	const resources = Object.fromEntries(
		pack.resources.map((resource) => [
			resource.id,
			{
				data: createResourceData(resource),
			},
		]),
	);

	return parseGameConfig({
		...(pack.config as Record<string, unknown>),
		resources,
	});
};

const bytesToBase64 = (bytes: Uint8Array) => {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
};
