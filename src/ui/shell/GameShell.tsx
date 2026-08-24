import type { PropsWithChildren, ReactNode } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { usePackageGameEngine } from "~/bridge/game/usePackageGameEngine";
import { GameMenu } from "~/ui/game-menu/GameMenu";
import { GameMenuProvider } from "~/ui/game-menu/GameMenuProvider";
import { ItemDetailHigherOwnerGuard } from "~/ui/item-detail/ItemDetailHigherOwnerGuard";
import type { ItemDetailHeaderIdentityRenderer } from "~/ui/item-detail/ItemDetailHeader";
import type { ItemLineSummaryIdentityRenderer } from "~/ui/item-detail/ItemLineSummary";
import { ItemDetailModal } from "~/ui/item-detail/ItemDetailModal";
import { ItemDetailProvider } from "~/ui/item-detail/ItemDetailProvider";
import { gameBoardViewTransitionName } from "~/ui/navigation/gameBoardViewTransitionName";
import { RouteBackdrop } from "~/ui/navigation/RouteBackdrop";
import { PixiGameProvider } from "~/ui/pixi/PixiGameProvider";

type GameShellRoutePresentation = "embedded" | "fullscreen";

const GameSceneBackdrop = ({
	routePresentation,
}: {
	readonly routePresentation: GameShellRoutePresentation;
}) =>
	routePresentation === "fullscreen" ? (
		<RouteBackdrop
			className="game-scene__backdrop pointer-events-none absolute inset-0 z-0"
			dataUi="GameSceneBackdrop"
		/>
	) : (
		<div
			aria-hidden="true"
			className="game-scene__backdrop pointer-events-none absolute inset-0 z-0"
			data-ui="GameSceneBackdrop"
		/>
	);

const GameTileScene = ({
	children,
	routePresentation,
}: PropsWithChildren<{
	readonly routePresentation: GameShellRoutePresentation;
}>) => (
	<div
		className="relative isolate z-10 size-full min-h-0 min-w-0"
		data-ui="TileScene"
		style={
			routePresentation === "fullscreen"
				? {
						viewTransitionName: gameBoardViewTransitionName,
					}
				: undefined
		}
	>
		<div
			className="size-full min-h-0 min-w-0"
			data-ui="GameSceneContent"
		>
			{children}
		</div>
	</div>
);

const GameShellLayers = ({
	children,
	game,
	itemDetailIdentityRenderer,
	itemDetailLineIdentityRenderer,
	menu,
	routePresentation,
}: PropsWithChildren<{
	readonly game: ReturnType<typeof useGameEngine>;
	readonly itemDetailIdentityRenderer?: ItemDetailHeaderIdentityRenderer;
	readonly itemDetailLineIdentityRenderer?: ItemLineSummaryIdentityRenderer;
	readonly menu?: ReactNode;
	readonly routePresentation: GameShellRoutePresentation;
}>) => {
	return (
		<>
			<ItemDetailProvider game={game}>
				<PixiGameProvider>
					<ItemDetailHigherOwnerGuard />
					<GameTileScene routePresentation={routePresentation}>{children}</GameTileScene>
					<ItemDetailModal
						renderIdentity={itemDetailIdentityRenderer}
						renderLineIdentity={itemDetailLineIdentityRenderer}
					/>
				</PixiGameProvider>
			</ItemDetailProvider>
			{menu}
		</>
	);
};

/**
 * React owner for route composition, focusable overlays and their precedence
 * across Board/Inventory navigation. The provider order is intentional: Item
 * Detail stays attached to the renderer scene, while Game Menu is the higher
 * interaction owner and dismisses Detail through ItemDetailHigherOwnerGuard.
 *
 * Gameplay remains outside this shell. Pixi surfaces present canonical bridge
 * projections and issue commands; neither React nor Pixi may infer committed
 * move/swap/stack outcomes. Tile input also stays immediate: ordinary click is
 * the primary action, while right click requests Item Detail without introducing
 * delayed or double-click arbitration here.
 */
export const PlayableGameShell = ({
	children,
	itemDetailIdentityRenderer,
	itemDetailLineIdentityRenderer,
	menu,
	routePresentation,
}: PropsWithChildren<{
	readonly menu?: ReactNode;
	readonly itemDetailIdentityRenderer?: ItemDetailHeaderIdentityRenderer;
	readonly itemDetailLineIdentityRenderer?: ItemLineSummaryIdentityRenderer;
	readonly routePresentation: GameShellRoutePresentation;
}>) => {
	const game = useGameEngine();
	return (
		<main
			className="relative size-full min-h-0 min-w-0 overflow-hidden bg-canvas text-foreground outline-none"
			data-ui="GameShell"
			tabIndex={-1}
		>
			<GameSceneBackdrop routePresentation={routePresentation} />
			<GameMenuProvider keyboardEnabled={menu !== undefined}>
				<GameShellLayers
					game={game}
					itemDetailIdentityRenderer={itemDetailIdentityRenderer}
					itemDetailLineIdentityRenderer={itemDetailLineIdentityRenderer}
					menu={menu}
					routePresentation={routePresentation}
				>
					{children}
				</GameShellLayers>
			</GameMenuProvider>
		</main>
	);
};

/** Adds installed-package Game Menu actions to the shared gameplay shell. */
export function GameShell({ children }: PropsWithChildren) {
	const game = usePackageGameEngine();
	return (
		<PlayableGameShell
			menu={<GameMenu game={game} />}
			routePresentation="fullscreen"
		>
			{children}
		</PlayableGameShell>
	);
}
