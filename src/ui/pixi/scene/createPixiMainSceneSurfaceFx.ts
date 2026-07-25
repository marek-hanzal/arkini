import { Effect } from "effect";
import { Container, Graphics, Rectangle } from "pixi.js";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { DropItemResultKindEnumSchema } from "~/bridge/tile/DropItemResultKindEnumSchema";
import { LocationScopeEnumSchema } from "~/bridge/tile/LocationScopeEnumSchema";
import type { readTileDropPreviewFx } from "~/bridge/tile/readTileDropPreviewFx";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { PixiGridSurfaceLayout, PixiMainSceneLayout } from "~/ui/pixi/layout/PixiSceneLayout";
import { readPixiMainSceneLayoutFx } from "~/ui/pixi/layout/readPixiMainSceneLayoutFx";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import type { PixiSceneDropTarget } from "~/ui/pixi/scene/PixiSceneDropTarget";

export namespace createPixiMainSceneSurfaceFx {
	export interface Props {
		readonly application: PixiApplicationOwner;
		readonly game: GameEngine;
		readonly palette: PixiScenePalette;
		readonly readActors: () => Iterable<PixiTileActor>;
	}
}

const readSurfaceRadius = (surface: PixiGridSurfaceLayout) => Math.min(16, surface.cellSize * 0.12);

/** Owns main-scene geometry, layers, masks, hit testing and drop feedback paint. */
export const createPixiMainSceneSurfaceFx = Effect.fn("createPixiMainSceneSurfaceFx")(
	({
		application,
		game,
		palette: initialPalette,
		readActors,
	}: createPixiMainSceneSurfaceFx.Props) =>
		Effect.sync((): PixiMainSceneSurface => {
			let palette = initialPalette;
			let latestTransition = game.getTransitionSnapshot();
			let layout: PixiMainSceneLayout = RendererRuntime.runSync(
				readPixiMainSceneLayoutFx({
					boardHeight: game.config.meta.board.height,
					boardWidth: game.config.meta.board.width,
					height: application.app.screen.height,
					toolbarSize: game.config.meta.toolbarSize ?? 0,
					width: application.app.screen.width,
				}),
			);

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
			const feedbackLayer = new Graphics({
				eventMode: "none",
				label: "DropFeedbackLayer",
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
				feedbackLayer,
				boardMask,
				toolbarMask,
				boardActorLayer,
				toolbarActorLayer,
				transientActorLayer,
			);
			application.stage.eventMode = "static";

			const drawSurface = (
				graphics: Graphics,
				surface: PixiGridSurfaceLayout | null,
				colors: readonly [
					number,
					number,
				],
			) => {
				graphics.clear();
				if (surface === null) {
					graphics.visible = false;
					return;
				}
				graphics.visible = true;
				const radius = readSurfaceRadius(surface);
				graphics
					.roundRect(surface.x, surface.y, surface.width, surface.height, radius)
					.fill({
						alpha: 0.78,
						color: palette.surface,
					});
				for (let y = 0; y < surface.rows; y += 1) {
					for (let x = 0; x < surface.columns; x += 1) {
						graphics
							.rect(
								surface.x + x * surface.cellSize,
								surface.y + y * surface.cellSize,
								surface.cellSize,
								surface.cellSize,
							)
							.fill({
								alpha: 0.92,
								color: colors[(x + y) % 2],
							})
							.stroke({
								alpha: 0.55,
								color: palette.line,
								width: 1,
							});
					}
				}
				graphics
					.roundRect(surface.x, surface.y, surface.width, surface.height, radius)
					.stroke({
						color: palette.line,
						width: 1,
					});
			};

			const drawMasks = () => {
				boardMask
					.clear()
					.roundRect(
						layout.board.x,
						layout.board.y,
						layout.board.width,
						layout.board.height,
						readSurfaceRadius(layout.board),
					)
					.fill(0xffffff);
				toolbarMask.clear();
				if (layout.toolbar !== null) {
					toolbarMask
						.roundRect(
							layout.toolbar.x,
							layout.toolbar.y,
							layout.toolbar.width,
							layout.toolbar.height,
							readSurfaceRadius(layout.toolbar),
						)
						.fill(0xffffff);
				}
			};

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

			const hitSurface = (
				surface: PixiGridSurfaceLayout | null,
				x: number,
				y: number,
			): PixiSceneDropTarget | null => {
				if (
					surface === null ||
					x < surface.x ||
					x > surface.x + surface.width ||
					y < surface.y ||
					y > surface.y + surface.height
				) {
					return null;
				}
				const slotX = Math.min(
					surface.columns - 1,
					Math.floor((x - surface.x) / surface.cellSize),
				);
				const slotY = Math.min(
					surface.rows - 1,
					Math.floor((y - surface.y) / surface.cellSize),
				);
				if (slotX < 0 || slotY < 0) return null;
				return {
					kind: "slot",
					layout: surface,
					x: slotX,
					y: slotY,
				};
			};

			const readOccupant = (target: PixiSceneDropTarget) => {
				for (const actor of readActors()) {
					const location = actor.item.location;
					if (
						target.layout.kind === "board" &&
						location.scope === LocationScopeEnumSchema.enum.Board &&
						location.space === latestTransition.runtime.currentSpace &&
						location.position.x === target.x &&
						location.position.y === target.y
					) {
						return actor.item;
					}
					if (
						target.layout.kind === "toolbar" &&
						location.scope === LocationScopeEnumSchema.enum.Toolbar &&
						location.position.x === target.x
					) {
						return actor.item;
					}
				}
				return null;
			};

			return {
				transientActorLayer,
				readActorPoseFx: Effect.fn("PixiMainSceneSurface.readActorPoseFx")((item) =>
					Effect.sync(() => readLocationPose(item.location)),
				),
				readCommandTargetFx: Effect.fn("PixiMainSceneSurface.readCommandTargetFx")(
					(target) =>
						Effect.sync(() => {
							if (target === null) {
								return {
									kind: "unsupported" as const,
								};
							}
							const occupant = readOccupant(target);
							return {
								kind: "slot" as const,
								location:
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
											},
								occupant:
									occupant === null
										? null
										: {
												itemId: occupant.id,
												revision: occupant.revision,
											},
							};
						}),
				),
				readDropTargetFx: Effect.fn("PixiMainSceneSurface.readDropTargetFx")((x, y) =>
					Effect.sync(
						() => hitSurface(layout.toolbar, x, y) ?? hitSurface(layout.board, x, y),
					),
				),
				readLocationPoseFx: Effect.fn("PixiMainSceneSurface.readLocationPoseFx")(
					(location) => Effect.sync(() => readLocationPose(location)),
				),
				readOccupantFx: Effect.fn("PixiMainSceneSurface.readOccupantFx")((target) =>
					Effect.sync(() => readOccupant(target)),
				),
				redrawFx: Effect.sync(() => {
					layout = RendererRuntime.runSync(
						readPixiMainSceneLayoutFx({
							boardHeight: game.config.meta.board.height,
							boardWidth: game.config.meta.board.width,
							height: application.app.screen.height,
							toolbarSize: game.config.meta.toolbarSize ?? 0,
							width: application.app.screen.width,
						}),
					);
					application.stage.hitArea = new Rectangle(
						0,
						0,
						application.app.screen.width,
						application.app.screen.height,
					);
					drawSurface(boardGrid, layout.board, [
						palette.gridA,
						palette.gridB,
					]);
					drawSurface(toolbarGrid, layout.toolbar, [
						palette.toolbarA,
						palette.toolbarB,
					]);
					drawMasks();
					RendererRuntime.runSync(application.frames.invalidateFx);
				}),
				renderDropFeedbackFx: Effect.fn("PixiMainSceneSurface.renderDropFeedbackFx")(
					(
						target: PixiSceneDropTarget | null,
						kind: readTileDropPreviewFx.Result["kind"] | null,
					) =>
						Effect.sync(() => {
							feedbackLayer.clear();
							if (target !== null) {
								const accepted =
									kind !== null &&
									kind !== DropItemResultKindEnumSchema.enum.Reject &&
									kind !== DropItemResultKindEnumSchema.enum.Ignored;
								feedbackLayer
									.rect(
										target.layout.x + target.x * target.layout.cellSize,
										target.layout.y + target.y * target.layout.cellSize,
										target.layout.cellSize,
										target.layout.cellSize,
									)
									.fill({
										alpha: 0.16,
										color: accepted ? palette.accent : palette.danger,
									})
									.stroke({
										alpha: 0.95,
										color: accepted ? palette.accent : palette.danger,
										width: Math.max(2, target.layout.cellSize * 0.025),
									});
							}
							RendererRuntime.runSync(application.frames.invalidateFx);
						}),
				),
				setPaletteFx: Effect.fn("PixiMainSceneSurface.setPaletteFx")((nextPalette) =>
					Effect.sync(() => {
						palette = nextPalette;
					}),
				),
				setTransitionFx: Effect.fn("PixiMainSceneSurface.setTransitionFx")((transition) =>
					Effect.sync(() => {
						latestTransition = transition;
					}),
				),
			};
		}),
);
