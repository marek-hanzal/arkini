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
		readonly readCanonicalItem: (actorId: string) => TileActorItem | undefined;
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
		readCanonicalItem,
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
			const occupancy = new Map<string, string>();
			const occupancyKeysByActorId = new Map<string, ReadonlySet<string>>();

			const occupancyKey = (kind: "board" | "toolbar", x: number, y: number) =>
				`${kind}:${x}:${y}`;

			const readOccupancyKeys = (item: TileActorItem) => {
				const keys = new Set<string>();
				const location = item.location;
				if (
					location.scope === LocationScopeEnumSchema.enum.Board &&
					location.space === latestTransition.runtime.currentSpace
				) {
					for (let y = 0; y < item.footprint.height; y += 1) {
						for (let x = 0; x < item.footprint.width; x += 1) {
							keys.add(
								occupancyKey(
									"board",
									location.position.x + x,
									location.position.y + y,
								),
							);
						}
					}
				} else if (location.scope === LocationScopeEnumSchema.enum.Toolbar) {
					keys.add(occupancyKey("toolbar", location.position.x, 0));
				}
				return keys;
			};

			const refreshOccupancy = (affectedActorIds: ReadonlySet<string>) => {
				for (const actorId of affectedActorIds) {
					for (const key of occupancyKeysByActorId.get(actorId) ?? []) {
						if (occupancy.get(key) === actorId) occupancy.delete(key);
					}
					occupancyKeysByActorId.delete(actorId);
					const item = readCanonicalItem(actorId);
					if (item === undefined) continue;
					const keys = readOccupancyKeys(item);
					for (const key of keys) occupancy.set(key, item.id);
					occupancyKeysByActorId.set(actorId, keys);
				}
			};

			const rebuildOccupancy = () => {
				occupancy.clear();
				occupancyKeysByActorId.clear();
				const items = Array.from(readCanonicalItems());
				refreshOccupancy(new Set(items.map(({ id }) => id)));
			};

			const readLocationPose = (
				location: TileActorItem["location"],
				footprint = {
					height: 1,
					width: 1,
				},
			) => {
				if (
					location.scope === LocationScopeEnumSchema.enum.Board &&
					location.space === latestTransition.runtime.currentSpace
				) {
					return {
						layer: boardActorLayer,
						height: layout.board.cellSize * footprint.height,
						size: layout.board.cellSize,
						width: layout.board.cellSize * footprint.width,
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
						height: layout.toolbar.cellSize,
						size: layout.toolbar.cellSize,
						width: layout.toolbar.cellSize,
						x: layout.toolbar.x + location.position.x * layout.toolbar.cellSize,
						y: layout.toolbar.y,
					};
				}
				return null;
			};

			const readOccupant = (target: PixiSceneDropTarget) => {
				return (
					readCanonicalItem(
						occupancy.get(
							occupancyKey(
								target.layout.kind === "toolbar" ? "toolbar" : "board",
								target.hitX,
								target.hitY,
							),
						) ?? "",
					) ?? null
				);
			};

			const readLocalActorIds = (rect: {
				readonly height: number;
				readonly width: number;
				readonly x: number;
				readonly y: number;
			}) => {
				const actorIds = new Set<string>();
				for (const grid of [
					layout.board,
					...(layout.toolbar === null
						? []
						: [
								layout.toolbar,
							]),
				]) {
					const padding = 2;
					const left = Math.max(
						0,
						Math.floor((rect.x - grid.x) / grid.cellSize) - padding,
					);
					const top = Math.max(
						0,
						Math.floor((rect.y - grid.y) / grid.cellSize) - padding,
					);
					const right = Math.min(
						grid.columns - 1,
						Math.floor((rect.x + rect.width - grid.x) / grid.cellSize) + padding,
					);
					const bottom = Math.min(
						grid.rows - 1,
						Math.floor((rect.y + rect.height - grid.y) / grid.cellSize) + padding,
					);
					if (right < left || bottom < top) continue;
					const kind = grid.kind === "toolbar" ? "toolbar" : "board";
					for (let y = top; y <= bottom; y += 1) {
						for (let x = left; x <= right; x += 1) {
							const occupantId = occupancy.get(occupancyKey(kind, x, y));
							if (occupantId !== undefined) actorIds.add(occupantId);
						}
					}
				}
				return actorIds;
			};

			rebuildOccupancy();

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
					Effect.sync(() => readLocationPose(item.location, item.footprint)),
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
								hitLocation:
									target.layout.kind === "board"
										? {
												scope: LocationScopeEnumSchema.enum.Board,
												space: latestTransition.runtime.currentSpace,
												position: {
													x: target.hitX,
													y: target.hitY,
												},
											}
										: {
												scope: LocationScopeEnumSchema.enum.Toolbar,
												position: {
													x: target.hitX,
													y: 0,
												},
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
								hitX: toolbarSlot.x,
								hitY: toolbarSlot.y,
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
									hitX: boardSlot.x,
									hitY: boardSlot.y,
								};
					}),
				),
				readLocationPoseFx: Effect.fn("PixiMainSceneSurface.readLocationPoseFx")(
					(location, footprint) =>
						Effect.sync(() => readLocationPose(location, footprint)),
				),
				readLocalActorIdsFx: Effect.fn("PixiMainSceneSurface.readLocalActorIdsFx")((rect) =>
					Effect.sync(() => readLocalActorIds(rect)),
				),
				readOccupantFx: Effect.fn("PixiMainSceneSurface.readOccupantFx")((target) =>
					Effect.sync(() => readOccupant(target)),
				),
				refreshOccupancyFx: Effect.fn("PixiMainSceneSurface.refreshOccupancyFx")(
					(affectedActorIds) => Effect.sync(() => refreshOccupancy(affectedActorIds)),
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
						preview: readTileDropPreviewFx.Result | null,
					) =>
						Effect.gen(function* () {
							const kind = preview?.kind ?? null;
							const accepted =
								kind !== null &&
								kind !== DropItemResultKindEnumSchema.enum.Reject &&
								kind !== DropItemResultKindEnumSchema.enum.Ignored;
							const requestedColor = accepted ? palette.accent : palette.danger;
							const explicitOccupantId =
								target === null ? null : (readOccupant(target)?.id ?? null);
							const collisionActorIds =
								preview !== null && "collisions" in preview
									? preview.collisions.map(({ itemId }) => itemId)
									: [];
							const collisionMarkers =
								target === null
									? []
									: collisionActorIds.flatMap((actorId) =>
											actorId === explicitOccupantId
												? []
												: Array.from(
														occupancyKeysByActorId.get(actorId) ?? [],
													).flatMap((key) => {
														const [kind, x, y] = key.split(":");
														return kind === target.layout.kind
															? [
																	{
																		color: palette.danger,
																		slot: {
																			x: Number(x),
																			y: Number(y),
																		},
																	},
																]
															: [];
													}),
										);
							const requestedSlot =
								target === null
									? null
									: {
											x: target.x,
											y: target.y,
											width:
												target.layout.kind === "board"
													? preview?.destinationFootprint?.width
													: 1,
											height:
												target.layout.kind === "board"
													? preview?.destinationFootprint?.height
													: 1,
										};
							yield* dropFeedback.renderFx({
								color: requestedColor,
								markers:
									target === null || requestedSlot === null
										? undefined
										: [
												{
													color: requestedColor,
													slot: requestedSlot,
												},
												...collisionMarkers,
												{
													color: palette.foreground,
													slot: {
														x: target.hitX,
														y: target.hitY,
													},
												},
											],
								slot: requestedSlot,
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
