import Phaser from "phaser";
import { type FC, memo, useCallback, useEffect, useRef } from "react";
import { PhaserBoardScene } from "~/phaser/board/PhaserBoardScene";
import type { BoardView, ItemCatalogView, ProducerDropResult } from "~/play/logic/playTypes";
import type { BoardViewItem } from "~/play/logic/playTypes";

export namespace PhaserBoard {
	export interface Handlers extends PhaserBoardScene.Handlers {}

	export interface Props {
		board: BoardView;
		items: ItemCatalogView;
		handlers: Handlers;
	}
}

export const PhaserBoard: FC<PhaserBoard.Props> = memo(({ board, items, handlers }) => {
	const hostRef = useRef<HTMLDivElement | null>(null);
	const sceneRef = useRef<PhaserBoardScene | null>(null);
	const gameRef = useRef<Phaser.Game | null>(null);
	const propsRef = useRef<PhaserBoard.Props>({
		board,
		items,
		handlers,
	});
	propsRef.current = {
		board,
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

		const scene = new PhaserBoardScene();
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
			board,
			items,
			handlers,
		});
	}, [board, items, handlers]);

	return (
		<div
			ref={hostRef}
			className="h-full w-full touch-none overflow-hidden rounded-md"
			aria-label="Merge board"
		/>
	);
});

export type PhaserBoardHandlerResult = ProducerDropResult | void;
export type PhaserBoardItemHandler = (item: BoardViewItem) => Promise<PhaserBoardHandlerResult>;
