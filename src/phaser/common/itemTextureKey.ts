import Phaser from "phaser";
import type { ViewItem } from "~/play/logic/playTypes";

export const itemTextureKey = (itemId: string) => `ak:item:${itemId}`;

export const itemOverlayTextureKey = (itemId: string) => `ak:item:${itemId}:overlay`;

export const loadItemTextures = (
	scene: Phaser.Scene,
	items: Record<string, ViewItem>,
) => {
	let queued = false;
	for (const item of Object.values(items)) {
		const textureKey = itemTextureKey(item.id);
		if (!scene.textures.exists(textureKey)) {
			scene.load.image(textureKey, item.assetSrc);
			queued = true;
		}

		if (item.assetOverlaySrc) {
			const overlayKey = itemOverlayTextureKey(item.id);
			if (!scene.textures.exists(overlayKey)) {
				scene.load.image(overlayKey, item.assetOverlaySrc);
				queued = true;
			}
		}
	}
	return queued;
};
