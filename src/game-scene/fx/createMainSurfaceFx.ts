import { Effect } from "effect";
import { Container, Graphics, Rectangle } from "pixi.js";

import type { GameEngine } from "~/playable-game/type/GameEngine";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import { DropItemResultKind } from "~/item-interaction/type/DropItemResult";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import type { readTileDropPreviewFx } from "~/tile-interaction/fx/readTileDropPreviewFx";
import type { MainInteractionSurface } from "~/tile-interaction/type/MainInteractionSurface";
import type { MainActorStore } from "~/tile-rendering/service/MainActorStore";
import type { PixiScenePalette } from "~/tile-rendering/type/PixiScenePalette";
import type { DropFeedback } from "~/game-scene/service/DropFeedback";
import { drawMaskFx } from "~/game-scene/fx/drawMaskFx";
import { drawSurfaceFx } from "~/game-scene/fx/drawSurfaceFx";
import { readSlotFn } from "~/game-scene/fn/readSlotFn";
import { readMainLayoutFn } from "~/game-scene/fn/readMainLayoutFn";
import type { MainLayout, SurfaceLayout } from "~/game-scene/type/SceneLayout";
import type { PixiApplicationOwner } from "~/tile-rendering/service/PixiApplicationOwner";
import type { MainSurface } from "~/game-scene/service/MainSurface";

interface PixiSceneDropTarget {
	readonly kind: "slot";
	readonly layout: SurfaceLayout;
	readonly x: number;
	readonly y: number;
}

type TargetFacts = Effect.Success<ReturnType<MainInteractionSurface["readTargetFactsFx"]>>;

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
			let latestTransition = game.getTransitionSnapshot();
			let layoutRevision = 0;
			let layout: MainLayout = readMainLayoutFn({
				boardHeight: game.config.meta.board.height,
				boardWidth: game.config.meta.board.width,
				height: application.app.screen.height,
				toolbarSize: game.config.meta.toolbarSize ?? 0,
				width: application.app.screen.width,
			});

			const gridLayer = new Container({
				eventMode: "none",
				label: "GridLayer",
			});
			const boardActorLayer = new Container({
				eventMode: "passive",
				label: "BoardActorLayer",
			});
			const toolbarActorLayer = new Container({
				eventMode: "passive",
				label: "ToolbarActorLayer",
			});
			const transientActorLayer = new Container({
				eventMode: "passive",
				label: "TransientActorLayer",
			});
			const boardGrid = new Graphics({
				eventMode: "none",
				label: "BoardGrid",
			});
			const toolbarGrid = new Graphics({
				eventMode: "none",
				label: "ToolbarGrid",
			});
			const boardMask = new Graphics({
				eventMode: "none",
				label: "BoardMask",
			});
			const toolbarMask = new Graphics({
				eventMode: "none",
				label: "ToolbarMask",
			});

			gridLayer.addChild(boardGrid, toolbarGrid);
			boardGrid.mask = boardMask;
			toolbarGrid.mask = toolbarMask;
			boardActorLayer.mask = boardMask;
			toolbarActorLayer.mask = toolbarMask;
			application.stage.addChild(
				gridLayer,
				dropFeedback.container,
				boardMask,
				toolbarMask,
				boardActorLayer,
				toolbarActorLayer,
				transientActorLayer,
			);
			application.stage.eventMode = "static";
			let closed = false;

			const readLocationPose = (location: TileActorItem["location"]) => {
				if (
					location.scope === LocationScopeEnumSchema.enum.Board &&
					location.space === latestTransition.runtime.currentSpace
				) {
					return {
						layer: boardActorLayer,
						size: layout.board.cellSize,
						x: layout.board.x + location.position.x * layout.board.cellSize,
						y: layout.board.y + location.position.y * layout.board.cellSize,
					};
				}
				if (
					location.scope === LocationScopeEnumSchema.enum.Toolbar &&
					layout.toolbar !== null
				) {
					return {
						layer: toolbarActorLayer,
						size: layout.toolbar.cellSize,
						x: layout.toolbar.x + location.position.x * layout.toolbar.cellSize,
						y: layout.toolbar.y,
					};
				}
				return null;
			};

			const readTargetLocation = (target: PixiSceneDropTarget): TileActorItem["location"] =>
				target.layout.kind === "board"
					? {
							scope: LocationScopeEnumSchema.enum.Board,
							space: latestTransition.runtime.currentSpace,
							position: {
								x: target.x,
								y: target.y,
							},
						}
					: {
							scope: LocationScopeEnumSchema.enum.Toolbar,
							position: {
								x: target.x,
								y: 0,
							},
						};

			const readTargetFactsFromTarget = (
				target: PixiSceneDropTarget | null,
			): Effect.Effect<TargetFacts> =>
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
					const location = readTargetLocation(target);
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

			const readDropTarget = (x: number, y: number): PixiSceneDropTarget | null => {
				const toolbar = layout.toolbar;
				const toolbarSlot = readSlotFn({
					surface: toolbar,
					x,
					y,
				});
				if (toolbar !== null && toolbarSlot !== null) {
					return {
						kind: "slot" as const,
						layout: toolbar,
						...toolbarSlot,
					};
				}
				const boardSlot = readSlotFn({
					surface: layout.board,
					x,
					y,
				});
				return boardSlot === null
					? null
					: {
							kind: "slot" as const,
							layout: layout.board,
							...boardSlot,
						};
			};

			const appendIntersectingLocations = (
				locations: TileActorItem["location"][],
				surface: MainLayout["board"] | null,
				bounds: {
					readonly height: number;
					readonly paddingRatio?: number;
					readonly width: number;
					readonly x: number;
					readonly y: number;
				},
			) => {
				const padding =
					surface === null
						? 0
						: Math.max(bounds.width, bounds.height, surface.cellSize) *
							(bounds.paddingRatio ?? 0);
				const queryBounds = {
					height: bounds.height + padding * 2,
					width: bounds.width + padding * 2,
					x: bounds.x - padding,
					y: bounds.y - padding,
				};
				if (
					surface === null ||
					queryBounds.width <= 0 ||
					queryBounds.height <= 0 ||
					queryBounds.x >= surface.x + surface.width ||
					queryBounds.y >= surface.y + surface.height ||
					queryBounds.x + queryBounds.width <= surface.x ||
					queryBounds.y + queryBounds.height <= surface.y
				) {
					return;
				}
				const firstX = Math.max(
					0,
					Math.floor((queryBounds.x - surface.x) / surface.cellSize),
				);
				const lastX = Math.min(
					surface.columns - 1,
					Math.ceil((queryBounds.x + queryBounds.width - surface.x) / surface.cellSize) -
						1,
				);
				const firstY = Math.max(
					0,
					Math.floor((queryBounds.y - surface.y) / surface.cellSize),
				);
				const lastY = Math.min(
					surface.rows - 1,
					Math.ceil((queryBounds.y + queryBounds.height - surface.y) / surface.cellSize) -
						1,
				);
				for (let slotY = firstY; slotY <= lastY; slotY += 1) {
					for (let slotX = firstX; slotX <= lastX; slotX += 1) {
						locations.push(
							surface.kind === "board"
								? {
										scope: LocationScopeEnumSchema.enum.Board,
										space: latestTransition.runtime.currentSpace,
										position: {
											x: slotX,
											y: slotY,
										},
									}
								: {
										scope: LocationScopeEnumSchema.enum.Toolbar,
										position: {
											x: slotX,
											y: 0,
										},
									},
						);
					}
				}
			};

			return {
				transientActorLayer,
				closeFx: Effect.sync(() => {
					if (closed) return;
					closed = true;
					for (const displayObject of [
						transientActorLayer,
						toolbarActorLayer,
						boardActorLayer,
						toolbarMask,
						boardMask,
						gridLayer,
					]) {
						if (displayObject.destroyed) continue;
						displayObject.destroy({
							children: true,
						});
					}
				}),
				readActorPoseFx: Effect.fn("MainSurface.readActorPoseFx")((item) =>
					Effect.sync(() => readLocationPose(item.location)),
				),
				readTargetFactsFx: Effect.fn("MainSurface.readTargetFactsFx")((x, y) =>
					readTargetFactsFromTarget(readDropTarget(x, y)),
				),
				readLocationPoseFx: Effect.fn("MainSurface.readLocationPoseFx")((location) =>
					Effect.sync(() => readLocationPose(location)),
				),
				readLocalActorIdsFx: Effect.fn("MainSurface.readLocalActorIdsFx")((bounds) =>
					Effect.gen(function* () {
						const locations: TileActorItem["location"][] = [];
						appendIntersectingLocations(locations, layout.board, bounds);
						appendIntersectingLocations(locations, layout.toolbar, bounds);
						const occupants = yield* actorStore.readCanonicalOccupantsFx(locations);
						return occupants
							.filter(({ id }) => id !== bounds.excludeActorId)
							.map(({ id }) => id);
					}),
				),
				redrawFx: Effect.gen(function* () {
					layoutRevision += 1;
					layout = readMainLayoutFn({
						boardHeight: game.config.meta.board.height,
						boardWidth: game.config.meta.board.width,
						height: application.app.screen.height,
						toolbarSize: game.config.meta.toolbarSize ?? 0,
						width: application.app.screen.width,
					});
					application.stage.hitArea = new Rectangle(
						0,
						0,
						application.app.screen.width,
						application.app.screen.height,
					);
					yield* drawSurfaceFx({
						graphics: boardGrid,
						lineColor: palette.line,
						slotColors: [
							palette.gridA,
							palette.gridB,
						],
						surface: layout.board,
						surfaceColor: palette.surface,
					});
					yield* drawSurfaceFx({
						graphics: toolbarGrid,
						lineColor: palette.line,
						slotColors: [
							palette.toolbarA,
							palette.toolbarB,
						],
						surface: layout.toolbar,
						surfaceColor: palette.surface,
					});
					yield* drawMaskFx({
						graphics: boardMask,
						surface: layout.board,
					});
					yield* drawMaskFx({
						graphics: toolbarMask,
						surface: layout.toolbar,
					});
					yield* application.frames.invalidateFx;
				}),
				renderDropFeedbackFx: Effect.fn("MainSurface.renderDropFeedbackFx")(
					(
						target: PixiSceneDropTarget | null,
						kind: readTileDropPreviewFx.Result["kind"] | null,
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
