import { Effect } from "effect";
import { Container, Graphics, Rectangle } from "pixi.js";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { DropItemResultKindEnumSchema } from "~/bridge/tile/DropItemResultKindEnumSchema";
import { LocationScopeEnumSchema } from "~/bridge/tile/LocationScopeEnumSchema";
import type { readTileDropPreviewFx } from "~/bridge/tile/readTileDropPreviewFx";
import { readScenePaletteFx } from "~/ui/pixi/appearance/readScenePaletteFx";
import type { PixiGridDropFeedback } from "~/ui/pixi/grid/PixiGridDropFeedback";
import { drawMaskFx } from "~/ui/pixi/grid/drawMaskFx";
import { drawSurfaceFx } from "~/ui/pixi/grid/drawSurfaceFx";
import { readSlotFx } from "~/ui/pixi/grid/readSlotFx";
import type { PixiInventorySceneLayout } from "~/ui/pixi/layout/PixiSceneLayout";
import { readInventoryLayoutFx } from "~/ui/pixi/layout/readInventoryLayoutFx";
import { readMainLayoutFx } from "~/ui/pixi/layout/readMainLayoutFx";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { PixiInventoryDropTarget } from "~/ui/pixi/scene/PixiInventoryDropTarget";
import type {
	PixiInventoryActorPose,
	PixiInventorySceneSurface,
} from "~/ui/pixi/scene/PixiInventorySceneSurface";

export namespace createInventorySurfaceFx {
	export interface Props {
		readonly application: PixiApplicationOwner;
		readonly dropFeedback: PixiGridDropFeedback;
		readonly game: GameEngine;
		readonly host: HTMLElement;
	}
}

/** Owns Inventory layout, grid chrome, masks, hit geometry and drop feedback. */
export const createInventorySurfaceFx = Effect.fn("createInventorySurfaceFx")(function* ({
	application,
	dropFeedback,
	game,
	host,
}: createInventorySurfaceFx.Props) {
	let palette = yield* readScenePaletteFx(host);
	const grid = new Graphics({
		eventMode: "none",
		label: "InventoryGrid",
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
	application.stage.addChild(grid, dropFeedback.container, mask, actorLayer);
	application.stage.eventMode = "static";
	let closed = false;

	const createLayout = () => {
		const width = Math.max(1, application.app.screen.width);
		const height = Math.max(1, application.app.screen.height);
		const preferredCellSize = RendererRuntime.runSync(
			readMainLayoutFx({
				boardHeight: game.config.meta.board.height,
				boardWidth: game.config.meta.board.width,
				height,
				toolbarSize: game.config.meta.toolbarSize ?? 0,
				width,
			}),
		).board.cellSize;
		return RendererRuntime.runSync(
			readInventoryLayoutFx({
				columns: game.config.meta.inventory.width,
				height,
				preferredCellSize,
				rows: game.config.meta.inventory.height,
				width,
			}),
		);
	};

	let layout: PixiInventorySceneLayout = createLayout();

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
			readSlotFx({
				surface: layout.surface,
				x,
				y,
			}) satisfies Effect.Effect<PixiInventoryDropTarget | null>,
	);

	const renderDropFeedbackFx = Effect.fn("PixiInventorySceneSurface.renderDropFeedbackFx")(
		(
			target: PixiInventoryDropTarget | null,
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
					surface: layout.surface,
				});
				yield* application.frames.invalidateFx;
			}),
	);

	const redrawFx = Effect.gen(function* () {
		layout = createLayout();
		application.stage.hitArea = new Rectangle(
			0,
			0,
			application.app.screen.width,
			application.app.screen.height,
		);
		yield* drawSurfaceFx({
			graphics: grid,
			lineColor: palette.line,
			slotColors: [
				palette.gridA,
				palette.gridB,
			],
			surface: layout.surface,
			surfaceColor: palette.surface,
		});
		yield* drawMaskFx({
			graphics: mask,
			surface: layout.surface,
		});
		yield* application.frames.invalidateFx;
	});

	return {
		actorLayer,
		closeFx: Effect.sync(() => {
			if (closed) return;
			closed = true;
			for (const displayObject of [
				actorLayer,
				mask,
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
			palette = yield* readScenePaletteFx(host);
			yield* redrawFx;
		}),
		renderDropFeedbackFx,
	} satisfies PixiInventorySceneSurface;
});
