import { Effect } from "effect";
import { Container, Graphics, Rectangle } from "pixi.js";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { DropItemResultKindEnumSchema } from "~/bridge/tile/DropItemResultKindEnumSchema";
import { LocationScopeEnumSchema } from "~/bridge/tile/LocationScopeEnumSchema";
import type { readTileDropPreviewFx } from "~/bridge/tile/readTileDropPreviewFx";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { PixiGridDropFeedback } from "~/ui/pixi/grid/PixiGridDropFeedback";
import { drawPixiGridMaskFx } from "~/ui/pixi/grid/drawPixiGridMaskFx";
import { drawPixiGridSurfaceFx } from "~/ui/pixi/grid/drawPixiGridSurfaceFx";
import { readPixiGridSlotFx } from "~/ui/pixi/grid/readPixiGridSlotFx";
import type { PixiMainSceneLayout } from "~/ui/pixi/layout/PixiSceneLayout";
import { readPixiMainSceneLayoutFx } from "~/ui/pixi/layout/readPixiMainSceneLayoutFx";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import type { PixiSceneDropTarget } from "~/ui/pixi/scene/PixiSceneDropTarget";

export namespace createPixiMainSceneSurfaceFx {
	export interface Props {
		readonly application: PixiApplicationOwner;
		readonly dropFeedback: PixiGridDropFeedback;
		readonly game: GameEngine;
		readonly palette: PixiScenePalette;
		readonly readCanonicalItems: () => Iterable<TileActorItem>;
	}
}

/** Owns main-scene geometry, layers, masks, hit testing and drop feedback paint. */
export const createPixiMainSceneSurfaceFx = Effect.fn("createPixiMainSceneSurfaceFx")(
	({
		application,
		dropFeedback,
		game,
		palette: initialPalette,
		readCanonicalItems,
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

			const readOccupant = (target: PixiSceneDropTarget) => {
				for (const item of readCanonicalItems()) {
					const location = item.location;
					if (
						target.layout.kind === "board" &&
						location.scope === LocationScopeEnumSchema.enum.Board &&
						location.space === latestTransition.runtime.currentSpace &&
						location.position.x === target.x &&
						location.position.y === target.y
					) {
						return item;
					}
					if (
						target.layout.kind === "toolbar" &&
						location.scope === LocationScopeEnumSchema.enum.Toolbar &&
						location.position.x === target.x
					) {
						return item;
					}
				}
				return null;
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
					Effect.gen(function* () {
						const toolbar = layout.toolbar;
						const toolbarSlot = yield* readPixiGridSlotFx({
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
						const boardSlot = yield* readPixiGridSlotFx({
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
					}),
				),
				readLocationPoseFx: Effect.fn("PixiMainSceneSurface.readLocationPoseFx")(
					(location) => Effect.sync(() => readLocationPose(location)),
				),
				readOccupantFx: Effect.fn("PixiMainSceneSurface.readOccupantFx")((target) =>
					Effect.sync(() => readOccupant(target)),
				),
				redrawFx: Effect.gen(function* () {
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
					yield* drawPixiGridSurfaceFx({
						graphics: boardGrid,
						lineColor: palette.line,
						slotColors: [
							palette.gridA,
							palette.gridB,
						],
						surface: layout.board,
						surfaceColor: palette.surface,
					});
					yield* drawPixiGridSurfaceFx({
						graphics: toolbarGrid,
						lineColor: palette.line,
						slotColors: [
							palette.toolbarA,
							palette.toolbarB,
						],
						surface: layout.toolbar,
						surfaceColor: palette.surface,
					});
					yield* drawPixiGridMaskFx({
						graphics: boardMask,
						surface: layout.board,
					});
					yield* drawPixiGridMaskFx({
						graphics: toolbarMask,
						surface: layout.toolbar,
					});
					yield* application.frames.invalidateFx;
				}),
				renderDropFeedbackFx: Effect.fn("PixiMainSceneSurface.renderDropFeedbackFx")(
					(
						target: PixiSceneDropTarget | null,
						kind: readTileDropPreviewFx.Result["kind"] | null,
					) =>
						Effect.gen(function* () {
							const accepted =
								kind !== null &&
								kind !== DropItemResultKindEnumSchema.enum.Reject &&
								kind !== DropItemResultKindEnumSchema.enum.Ignored;
							yield* dropFeedback.renderFx({
								color: accepted ? palette.accent : palette.danger,
								slot: target,
								surface: target?.layout ?? null,
							});
							yield* application.frames.invalidateFx;
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
