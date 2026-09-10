import { Effect } from "effect";
import { Container, Graphics } from "pixi.js";

import type { GameEngine } from "~/playable-game/type/GameEngine";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import { DropItemResultKind } from "~/item-interaction/type/DropItemResult";
import type { readDropItemPreviewFx } from "~/item-interaction/fx/readDropItemPreviewFx";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { readScenePaletteFx } from "~/tile-rendering/fx/readScenePaletteFx";
import type { DropFeedback } from "~/game-scene/service/DropFeedback";
import { drawMaskFx } from "~/game-scene/fx/drawMaskFx";
import { drawSurfaceFx } from "~/game-scene/fx/drawSurfaceFx";
import { readSlotFn } from "~/game-scene/fn/readSlotFn";
import { readInventoryLayoutFn } from "~/game-scene/fn/readInventoryLayoutFn";
import type { InventoryLayout } from "~/game-scene/type/SceneLayout";
import type { PixiApplicationOwner } from "~/tile-rendering/service/PixiApplicationOwner";
import type {
	InventoryActorPose,
	InventoryDropTarget,
	InventorySurface,
} from "~/game-scene/service/InventorySurface";

interface CreateInventorySurfaceProps {
	readonly application: PixiApplicationOwner;
	readonly dropFeedback: DropFeedback;
	readonly game: GameEngine;
	readonly host: HTMLElement;
}

/** Owns Inventory layout, grid chrome, masks, hit geometry and drop feedback. */
export const createInventorySurfaceFx = Effect.fn("createInventorySurfaceFx")(function* ({
	application,
	dropFeedback,
	game,
	host,
}: CreateInventorySurfaceProps) {
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

	const layout: InventoryLayout = readInventoryLayoutFn({
		columns: game.config.meta.inventory.width,
		rows: game.config.meta.inventory.height,
	});

	const readActorPoseFx = Effect.fn("InventorySurface.readActorPoseFx")((item: TileActorItem) =>
		Effect.sync((): InventoryActorPose | null => {
			if (item.location.scope !== LocationScopeEnumSchema.enum.Inventory) return null;
			const inset = (layout.surface.cellSize - layout.actorSize) / 2;
			return {
				x: layout.surface.x + item.location.position.x * layout.surface.cellSize + inset,
				y: layout.surface.y + item.location.position.y * layout.surface.cellSize + inset,
			};
		}),
	);

	const readDropTargetFx = Effect.fn("InventorySurface.readDropTargetFx")(
		(x: number, y: number) =>
			Effect.sync(
				() =>
					readSlotFn({
						surface: layout.surface,
						x,
						y,
					}) satisfies InventoryDropTarget | null,
			),
	);

	const renderDropFeedbackFx = Effect.fn("InventorySurface.renderDropFeedbackFx")(
		(target: InventoryDropTarget | null, kind: readDropItemPreviewFx.Result["kind"] | null) =>
			Effect.gen(function* () {
				const accepted =
					kind !== null &&
					kind !== DropItemResultKind.Reject &&
					kind !== DropItemResultKind.Ignored;
				yield* dropFeedback.renderFx({
					color: accepted ? palette.accent : palette.danger,
					slot: target,
					surface: layout.surface,
				});
				yield* application.frames.invalidateFx;
			}),
	);

	const redrawFx = Effect.gen(function* () {
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
	} satisfies InventorySurface;
});
