import { Effect } from "effect";
import { Container, Graphics, Rectangle } from "pixi.js";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { DropItemResultKindEnumSchema } from "~/bridge/tile/DropItemResultKindEnumSchema";
import { LocationScopeEnumSchema } from "~/bridge/tile/LocationScopeEnumSchema";
import type { readTileDropPreviewFx } from "~/bridge/tile/readTileDropPreviewFx";
import { readPixiScenePaletteFx } from "~/ui/pixi/appearance/readPixiScenePaletteFx";
import type { PixiInventorySceneLayout } from "~/ui/pixi/layout/PixiSceneLayout";
import { readPixiInventorySceneLayoutFx } from "~/ui/pixi/layout/readPixiInventorySceneLayoutFx";
import { readPixiMainSceneLayoutFx } from "~/ui/pixi/layout/readPixiMainSceneLayoutFx";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { PixiInventoryDropTarget } from "~/ui/pixi/scene/PixiInventoryDropTarget";
import type {
	PixiInventoryActorPose,
	PixiInventorySceneSurface,
} from "~/ui/pixi/scene/PixiInventorySceneSurface";

export namespace createPixiInventorySceneSurfaceFx {
	export interface Props {
		readonly application: PixiApplicationOwner;
		readonly game: GameEngine;
		readonly host: HTMLElement;
	}
}

/** Owns Inventory layout, grid chrome, masks, hit geometry and drop feedback. */
export const createPixiInventorySceneSurfaceFx = Effect.fn("createPixiInventorySceneSurfaceFx")(
	function* ({ application, game, host }: createPixiInventorySceneSurfaceFx.Props) {
		let palette = yield* readPixiScenePaletteFx(host);
		const grid = new Graphics({
			eventMode: "none",
			label: "InventoryGrid",
		});
		const feedback = new Graphics({
			eventMode: "none",
			label: "InventoryDropFeedback",
		});
		const mask = new Graphics({
			eventMode: "none",
			label: "InventoryMask",
		});
		const actorLayer = new Container({
			eventMode: "passive",
			label: "InventoryActorLayer",
		});
		grid.mask = mask;
		actorLayer.mask = mask;
		application.stage.addChild(grid, feedback, mask, actorLayer);
		application.stage.eventMode = "static";
		let closed = false;

		const readBoardActorSize = () => {
			const tileScene = host.closest<HTMLElement>('[data-ui="TileScene"]');
			const sceneWidth = Math.max(
				1,
				tileScene?.clientWidth ?? document.documentElement.clientWidth,
			);
			const sceneHeight = Math.max(
				1,
				tileScene?.clientHeight ?? document.documentElement.clientHeight,
			);
			return RendererRuntime.runSync(
				readPixiMainSceneLayoutFx({
					boardHeight: game.config.meta.board.height,
					boardWidth: game.config.meta.board.width,
					height: sceneHeight,
					toolbarSize: game.config.meta.toolbarSize ?? 0,
					width: sceneWidth,
				}),
			).board.cellSize;
		};

		const createLayout = () =>
			RendererRuntime.runSync(
				readPixiInventorySceneLayoutFx({
					actorSize: readBoardActorSize(),
					columns: game.config.meta.inventory.width,
					height: application.app.screen.height,
					rows: game.config.meta.inventory.height,
					width: application.app.screen.width,
				}),
			);

		let layout: PixiInventorySceneLayout = createLayout();

		const readSurfaceRadius = () => Math.min(16, layout.surface.cellSize * 0.12);

		const readActorPoseFx = Effect.fn("PixiInventorySceneSurface.readActorPoseFx")(
			(item: TileActorItem) =>
				Effect.sync((): PixiInventoryActorPose | null => {
					if (item.location.scope !== LocationScopeEnumSchema.enum.Inventory) return null;
					const inset = (layout.surface.cellSize - layout.actorSize) / 2;
					return {
						x:
							layout.surface.x +
							item.location.position.x * layout.surface.cellSize +
							inset,
						y:
							layout.surface.y +
							item.location.position.y * layout.surface.cellSize +
							inset,
					};
				}),
		);

		const readDropTargetFx = Effect.fn("PixiInventorySceneSurface.readDropTargetFx")(
			(x: number, y: number) =>
				Effect.sync((): PixiInventoryDropTarget | null => {
					const surface = layout.surface;
					if (
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
					return slotX < 0 || slotY < 0
						? null
						: {
								x: slotX,
								y: slotY,
							};
				}),
		);

		const renderDropFeedbackFx = Effect.fn("PixiInventorySceneSurface.renderDropFeedbackFx")(
			(
				target: PixiInventoryDropTarget | null,
				kind: readTileDropPreviewFx.Result["kind"] | null,
			) =>
				Effect.sync(() => {
					feedback.clear();
					if (target === null) {
						RendererRuntime.runSync(application.frames.invalidateFx);
						return;
					}
					const accepted =
						kind !== null &&
						kind !== DropItemResultKindEnumSchema.enum.Reject &&
						kind !== DropItemResultKindEnumSchema.enum.Ignored;
					feedback
						.rect(
							layout.surface.x + target.x * layout.surface.cellSize,
							layout.surface.y + target.y * layout.surface.cellSize,
							layout.surface.cellSize,
							layout.surface.cellSize,
						)
						.fill({
							alpha: 0.16,
							color: accepted ? palette.accent : palette.danger,
						})
						.stroke({
							alpha: 0.95,
							color: accepted ? palette.accent : palette.danger,
							width: Math.max(2, layout.surface.cellSize * 0.025),
						});
					RendererRuntime.runSync(application.frames.invalidateFx);
				}),
		);

		const redrawFx = Effect.sync(() => {
			layout = createLayout();
			application.stage.hitArea = new Rectangle(
				0,
				0,
				application.app.screen.width,
				application.app.screen.height,
			);
			const surface = layout.surface;
			const radius = readSurfaceRadius();
			grid.clear()
				.roundRect(surface.x, surface.y, surface.width, surface.height, radius)
				.fill({
					alpha: 0.78,
					color: palette.surface,
				});
			for (let y = 0; y < surface.rows; y += 1) {
				for (let x = 0; x < surface.columns; x += 1) {
					grid.rect(
						surface.x + x * surface.cellSize,
						surface.y + y * surface.cellSize,
						surface.cellSize,
						surface.cellSize,
					)
						.fill({
							alpha: 0.92,
							color: (x + y) % 2 === 0 ? palette.gridA : palette.gridB,
						})
						.stroke({
							alpha: 0.55,
							color: palette.line,
							width: 1,
						});
				}
			}
			grid.roundRect(surface.x, surface.y, surface.width, surface.height, radius).stroke({
				color: palette.line,
				width: 1,
			});
			mask.clear()
				.roundRect(surface.x, surface.y, surface.width, surface.height, radius)
				.fill(0xffffff);
			RendererRuntime.runSync(application.frames.invalidateFx);
		});

		return {
			actorLayer,
			closeFx: Effect.sync(() => {
				if (closed) return;
				closed = true;
				for (const displayObject of [
					actorLayer,
					mask,
					feedback,
					grid,
				]) {
					if (displayObject.destroyed) continue;
					displayObject.destroy({
						children: true,
					});
				}
			}),
			readActorPoseFx,
			readActorSizeFx: Effect.sync(() => layout.actorSize),
			readDropTargetFx,
			readPaletteFx: Effect.sync(() => palette),
			redrawFx,
			refreshPaletteFx: Effect.gen(function* () {
				palette = yield* readPixiScenePaletteFx(host);
				yield* redrawFx;
			}),
			renderDropFeedbackFx,
		} satisfies PixiInventorySceneSurface;
	},
);
