import { type PropsWithChildren, useLayoutEffect, useRef } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { CheatItemSpotlight } from "~/ui/cheat-spotlight/CheatItemSpotlight";
import { GameMenu } from "~/ui/game-menu/GameMenu";
import { GameMenuProvider } from "~/ui/game-menu/GameMenuProvider";
import { useGameMenuControl } from "~/ui/game-menu/useGameMenuControl";
import { InventoryHigherOwnerGuard } from "~/ui/inventory/InventoryHigherOwnerGuard";
import { InventoryHost } from "~/ui/inventory/InventoryHost";
import { InventoryProvider } from "~/ui/inventory/InventoryProvider";
import { ItemDetailHigherOwnerGuard } from "~/ui/item-detail/ItemDetailHigherOwnerGuard";
import { ItemDetailModal } from "~/ui/item-detail/ItemDetailModal";
import { ItemDetailProvider } from "~/ui/item-detail/ItemDetailProvider";
import { gameBoardViewTransitionName } from "~/ui/navigation/gameBoardViewTransitionName";
import { TileSystemProvider } from "~/ui/tile/TileSystemProvider";
import { useTileSystemApiContext } from "~/ui/tile/useTileSystemApiContext";

const noTileInteraction = () => undefined;

const TileInteractionResetBridge = ({
	resetRef,
}: {
	readonly resetRef: {
		current: () => void;
	};
}) => {
	const { resetInteraction } = useTileSystemApiContext();
	useLayoutEffect(() => {
		resetRef.current = resetInteraction;
		return () => {
			if (resetRef.current === resetInteraction) resetRef.current = noTileInteraction;
		};
	}, [
		resetInteraction,
		resetRef,
	]);
	return null;
};

const GameShellLayers = ({
	children,
	game,
}: PropsWithChildren<{
	readonly game: ReturnType<typeof useGameEngine>;
}>) => {
	const gameMenu = useGameMenuControl();
	const resetTileInteractionRef = useRef<() => void>(noTileInteraction);

	return (
		<>
			<ItemDetailProvider>
				<InventoryProvider>
					<ItemDetailHigherOwnerGuard />
					<InventoryHigherOwnerGuard />
					<div
						className="relative isolate z-0 size-full min-h-0 min-w-0"
						data-ui="TileScene"
						style={{
							viewTransitionName: gameBoardViewTransitionName,
						}}
					>
						<TileSystemProvider interactionBlocked={gameMenu.isOpen}>
							<TileInteractionResetBridge resetRef={resetTileInteractionRef} />
							{children}
							<InventoryHost />
						</TileSystemProvider>
					</div>
					<ItemDetailModal />
					<CheatItemSpotlight
						game={game}
						onBeforeOpen={() => resetTileInteractionRef.current()}
					/>
				</InventoryProvider>
			</ItemDetailProvider>
			<GameMenu game={game} />
		</>
	);
};

/** Renders the one playable board leaf over its route-scoped Game Engine. */
export function GameShell({ children }: PropsWithChildren) {
	const gameEngine = useGameEngine();
	return (
		<main
			className="relative size-full min-h-0 min-w-0 overflow-hidden bg-canvas text-foreground outline-none"
			data-ui="GameShell"
			tabIndex={-1}
		>
			<GameMenuProvider>
				<GameShellLayers game={gameEngine}>{children}</GameShellLayers>
			</GameMenuProvider>
		</main>
	);
}
