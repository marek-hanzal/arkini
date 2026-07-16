import { bytesToArrayBuffer } from "~/config/pack/bytesToArrayBuffer";
import type { GameConfig } from "~/config/GameConfigTypes";
import { createGameConfigFromArkiniPack } from "~/config/pack/createGameConfigFromArkiniPack";
import { decompressArkiniPackBytes } from "~/config/pack/decompressArkiniPackBytes";

export const loadGameConfigPackFromUrl = async (url: URL | string): Promise<GameConfig> => {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch Arkini pack: ${response.status} ${response.statusText}`);
	}
	const packBytes = await decompressArkiniPackBytes(new Uint8Array(await response.arrayBuffer()));

	return createGameConfigFromArkiniPack(packBytes, {
		createResourceData: (resource) =>
			URL.createObjectURL(
				new Blob(
					[
						bytesToArrayBuffer(resource.bytes),
					],
					{
						type: resource.mime,
					},
				),
			),
	});
};
