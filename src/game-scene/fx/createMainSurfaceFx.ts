import { readBoardSizeFn } from "~/game-runtime/fn/readBoardSizeFn";
import { Effect } from "effect";
import { Container, Graphics } from "pixi.js";

import type { GameEngine } from "~/playable-game/type/GameEngine";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import { DropItemResultKind } from "~/item-interaction/type/DropItemResult";
import type { readDropItemPreviewFx } from "~/item-interaction/fx/readDropItemPreviewFx";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import type { MainInteractionTargetFacts as TargetFacts } from "~/tile-interaction/type/MainInteractionSurface";
import type { MainActorStore } from "~/tile-rendering/service/MainActorStore";
import type { PixiScenePalette } from "~/tile-rendering/type/PixiScenePalette";
import type { DropFeedback } from "~/game-scene/service/DropFeedback";
import { drawMaskFx } from "~/game-scene/fx/drawMaskFx";
import { drawSurfaceFx } from "~/game-scene/fx/drawSurfaceFx";
import { readSlotFn } from "~/game-scene/fn/readSlotFn";
import { readMainLayoutFn } from "~/game-scene/fn/readMainLayoutFn";
import type { SurfaceLayout } from "~/game-scene/type/SceneLayout";
import type { PixiApplicationOwner } from "~/tile-rendering/service/PixiApplicationOwner";
import type { MainSurface } from "~/game-scene/service/MainSurface";

interface PixiSceneDropTarget {
	readonly kind: "slot";
	readonly layout: SurfaceLayout;
	readonly x: number;
	readonly y: number;
}

interface CreateMainSurfaceProps {
	readonly actorStore: MainActorStore;
	readonly application: PixiApplicationOwner;
	readonly dropFeedback: DropFeedback;
	readonly game: GameEngine;
	readonly palette: PixiScenePalette;
}

/** Owns main-scene geometry, layers, masks, hit testing and drop feedback paint. */
export const createMainSurfaceFx = Effect.fn("createMainSurfaceFx")(
	({
		actorStore,
		application,
		dropFeedback,
		game,
		palette: initialPalette,
	}: CreateMainSurfaceProps) =>
		Effect.sync((): MainSurface => {
			let palette = initialPalette;
			let latestTransition = game.getTransitionSnapshotFn();
			let layoutRevision = 0;
			const initialSize = readBoardSizeFn({
				config: game.config,
				runtime: latestTransition.runtime,
				space: latestTransition.runtime.currentSpace,
			});
			let layout: SurfaceLayout = readMainLayoutFn({
				boardHeight: initialSize.height,
				boardWidth: initialSize.width,
			});

			const boardPresentationLayer = new Container({
				eventMode: "passive",
				label: "BoardPresentationLayer",
			});
			const gridLayer = new Container({
				eventMode: "none",
				label: "GridLayer",
			});
			const boardActorLayer = new Container({
				eventMode: "passive",
				label: "BoardActorLayer",
			});
			const transientActorLayer = new Container({
				eventMode: "passive",
				label: "TransientActorLayer",
			});
			const boardGrid = new Graphics({
				eventMode: "none",
				label: "BoardGrid",
			});
			const boardMask = new Graphics({
				eventMode: "none",
				label: "BoardMask",
			});

			gridLayer.addChild(boardGrid);
			boardGrid.mask = boardMask;
			boardActorLayer.mask = boardMask;
			boardPresentationLayer.addChild(
				gridLayer,
				dropFeedback.container,
				boardMask,
				boardActorLayer,
				transientActorLayer,
			);
			application.stage.addChild(boardPresentationLayer);
			application.stage.eventMode = "static";
			let closed = false;

			const readLocationPoseFn = (location: TileActorItem["location"]) => {
				if (
					location.scope === LocationScopeEnumSchema.enum.Board &&
					location.space === latestTransition.runtime.currentSpace
				) {
					return {
						layer: boardActorLayer,
						size: layout.cellSize,
						x: layout.x + location.position.x * layout.cellSize,
						y: layout.y + location.position.y * layout.cellSize,
					};
				}
				return null;
			};

			const readTargetLocationFn = (
				target: PixiSceneDropTarget,
			): TileActorItem["location"] => ({
				scope: LocationScopeEnumSchema.enum.Board,
				space: latestTransition.runtime.currentSpace,
				position: {
					x: target.x,
					y: target.y,
				},
			});

			const readTargetFactsFromTargetFx = (
				target: PixiSceneDropTarget | null,
			): Effect.Effect<TargetFacts, never, never> =>
				Effect.gen(function* () {
					if (target === null) {
						return {
							commandTarget: {
								kind: "unsupported" as const,
							},
							occupant: null,
							stableKey: JSON.stringify([
								"unsupported",
								layoutRevision,
							]),
							target: null,
						};
					}
					const location = readTargetLocationFn(target);
					const occupant = yield* actorStore.readCanonicalOccupantFx(location);
					return {
						commandTarget: {
							kind: "slot" as const,
							location,
							occupant:
								occupant === null
									? null
									: {
											itemId: occupant.id,
											revision: occupant.revision,
										},
						},
						occupant,
						stableKey: JSON.stringify([
							layoutRevision,
							location.scope,
							location.scope === LocationScopeEnumSchema.enum.Board
								? location.space
								: null,
							location.position.x,
							location.position.y,
							occupant?.id ?? null,
							occupant?.revision ?? null,
						]),
						target,
					};
				});

			const readDropTargetFn = (x: number, y: number): PixiSceneDropTarget | null => {
				const boardSlot = readSlotFn({
					surface: layout,
					x,
					y,
				});
				return boardSlot === null
					? null
					: {
							kind: "slot" as const,
							layout,
							...boardSlot,
						};
			};

			return {
				boardPresentationLayer,
				transientActorLayer,
				closeFx: Effect.sync(() => {
					if (closed) return;
					closed = true;
					// Drop feedback owns its own cleanup after the surface closes.
					if (dropFeedback.container.parent === boardPresentationLayer) {
						boardPresentationLayer.removeChild(dropFeedback.container);
					}
					if (!boardPresentationLayer.destroyed) {
						boardPresentationLayer.destroy({
							children: true,
						});
					}
				}),
				readActorPoseFx: Effect.fn("MainSurface.readActorPoseFx")((item) =>
					Effect.sync(() => readLocationPoseFn(item.location)),
				),
				readTargetFactsFx: Effect.fn("MainSurface.readTargetFactsFx")((x, y) =>
					readTargetFactsFromTargetFx(readDropTargetFn(x, y)),
				),
				redrawFx: Effect.gen(function* () {
					layoutRevision += 1;
					const size = readBoardSizeFn({
						config: game.config,
						runtime: latestTransition.runtime,
						space: latestTransition.runtime.currentSpace,
					});
					layout = readMainLayoutFn({
						boardHeight: size.height,
						boardWidth: size.width,
					});

					yield* drawSurfaceFx({
						graphics: boardGrid,
						lineColor: palette.line,
						slotColors: [
							palette.gridA,
							palette.gridB,
						],
						surface: layout,
						surfaceColor: palette.surface,
					});
					yield* drawMaskFx({
						graphics: boardMask,
						surface: layout,
					});
					yield* application.frames.invalidateFx;
				}),
				renderDropFeedbackFx: Effect.fn("MainSurface.renderDropFeedbackFx")(
					(
						target: PixiSceneDropTarget | null,
						kind: readDropItemPreviewFx.Result["kind"] | null,
					) =>
						Effect.gen(function* () {
							const accepted =
								kind !== null &&
								kind !== DropItemResultKind.Reject &&
								kind !== DropItemResultKind.Ignored;
							yield* dropFeedback.renderFx({
								color: accepted ? palette.accent : palette.danger,
								slot: target,
								surface: target?.layout ?? null,
							});
							yield* application.frames.invalidateFx;
						}),
				),
				setPaletteFx: Effect.fn("MainSurface.setPaletteFx")((nextPalette) =>
					Effect.sync(() => {
						palette = nextPalette;
					}),
				),
				setTransitionFx: Effect.fn("MainSurface.setTransitionFx")((transition) =>
					Effect.sync(() => {
						latestTransition = transition;
					}),
				),
			};
		}),
);
