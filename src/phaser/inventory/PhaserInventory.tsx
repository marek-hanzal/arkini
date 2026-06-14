import Phaser from "phaser";
import { type FC, memo, useCallback, useEffect, useRef } from "react";
import { PhaserInventoryScene } from "~/phaser/inventory/PhaserInventoryScene";
import type { InventoryView, ItemCatalogView } from "~/play/logic/playTypes";

export namespace PhaserInventory {
	export interface Handlers extends PhaserInventoryScene.Handlers {}

	export interface Props {
		inventory: InventoryView;
		items: ItemCatalogView;
		handlers: Handlers;
	}
}

export const PhaserInventory: FC<PhaserInventory.Props> = memo(({ inventory, items, handlers }) => {
	const hostRef = useRef<HTMLDivElement | null>(null);
	const sceneRef = useRef<PhaserInventoryScene | null>(null);
	const gameRef = useRef<Phaser.Game | null>(null);
	const propsRef = useRef<PhaserInventory.Props>({
		inventory,
		items,
		handlers,
	});
	propsRef.current = {
		inventory,
		items,
		handlers,
	};

	const resize = useCallback(() => {
		const host = hostRef.current;
		const game = gameRef.current;
		const scene = sceneRef.current;
		if (!host || !game || !scene) return;
		const rect = host.getBoundingClientRect();
		const width = Math.max(1, Math.floor(rect.width));
		const height = Math.max(1, Math.floor(rect.height));
		game.scale.resize(width, height);
		scene.resize(width, height);
	}, []);

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;

		const scene = new PhaserInventoryScene();
		sceneRef.current = scene;
		scene.setProps(propsRef.current);

		const game = new Phaser.Game({
			type: Phaser.AUTO,
			parent: host,
			width: 1,
			height: 1,
			transparent: true,
			backgroundColor: "rgba(2,6,23,0)",
			scale: {
				mode: Phaser.Scale.NONE,
				autoCenter: Phaser.Scale.NO_CENTER,
			},
			render: {
				antialias: true,
				pixelArt: false,
			},
			input: {
				activePointers: 2,
			},
			scene,
		});
		gameRef.current = game;

		const observer = new ResizeObserver(resize);
		observer.observe(host);
		resize();

		return () => {
			observer.disconnect();
			game.destroy(true);
			gameRef.current = null;
			sceneRef.current = null;
		};
	}, [resize]);

	useEffect(() => {
		sceneRef.current?.setProps({
			inventory,
			items,
			handlers,
		});
	}, [inventory, items, handlers]);

	return (
		<div
			ref={hostRef}
			className="h-full w-full touch-none overflow-hidden"
			aria-label="Inventory grid"
		/>
	);
});
