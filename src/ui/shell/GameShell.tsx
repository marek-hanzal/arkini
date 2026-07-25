import type { PropsWithChildren } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { CheatItemSpotlight } from "~/ui/cheat-spotlight/CheatItemSpotlight";
import { GameMenu } from "~/ui/game-menu/GameMenu";
import { GameMenuProvider } from "~/ui/game-menu/GameMenuProvider";
import { InventoryHigherOwnerGuard } from "~/ui/inventory/InventoryHigherOwnerGuard";
import { InventoryHost } from "~/ui/inventory/InventoryHost";
import { InventoryProvider } from "~/ui/inventory/InventoryProvider";
import { useInventoryControl } from "~/ui/inventory/useInventoryControl";
import { ItemDetailHigherOwnerGuard } from "~/ui/item-detail/ItemDetailHigherOwnerGuard";
import { ItemDetailModal } from "~/ui/item-detail/ItemDetailModal";
import { ItemDetailProvider } from "~/ui/item-detail/ItemDetailProvider";
import { gameBoardViewTransitionName } from "~/ui/navigation/gameBoardViewTransitionName";
import { PixiGameProvider } from "~/ui/pixi/PixiGameProvider";
import { usePixiGameRuntime } from "~/ui/pixi/usePixiGameRuntime";

const CheatItemSpotlightHost = ({ game }: { readonly game: ReturnType<typeof useGameEngine> }) => {
	const { interaction } = usePixiGameRuntime();
	return (
		<CheatItemSpotlight
			game={game}
			onBeforeOpen={() => RendererRuntime.runSync(interaction.cancelFx)}
		/>
	);
};

const GameTileScene = ({
	children,
	game,
}: PropsWithChildren<{
	readonly game: ReturnType<typeof useGameEngine>;
}>) => {
	const inventory = useInventoryControl();
	return (
		<div
			className="relative isolate z-0 size-full min-h-0 min-w-0"
			data-ui="TileScene"
			style={{
				viewTransitionName: gameBoardViewTransitionName,
			}}
		>
			<div
				aria-hidden={inventory.isOpen ? "true" : undefined}
				className="size-full min-h-0 min-w-0"
				data-ui="GameSceneContent"
				inert={inventory.isOpen}
			>
				{children}
			</div>
			<InventoryHost />
			<CheatItemSpotlightHost game={game} />
		</div>
	);
};

const GameShellLayers = ({
	children,
	game,
}: PropsWithChildren<{
	readonly game: ReturnType<typeof useGameEngine>;
}>) => {
	return (
		<>
			<ItemDetailProvider>
				<InventoryProvider>
					<PixiGameProvider>
						<ItemDetailHigherOwnerGuard />
						<InventoryHigherOwnerGuard />
						<GameTileScene game={game}>{children}</GameTileScene>
						<ItemDetailModal />
					</PixiGameProvider>
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
