import { Effect } from "effect";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { runTileDropAtom } from "~/bridge/tile/runTileDropAtom";
import type { readTileDropPreviewFx } from "~/bridge/tile/readTileDropPreviewFx";
import type { PixiMainSceneDropPresentation } from "~/ui/pixi/drop/PixiMainSceneDropPresentation";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import type { PixiSceneDropTarget } from "~/ui/pixi/scene/PixiSceneDropTarget";

export namespace beginPixiMainSceneDropFx {
	export interface Props {
		readonly dropPresentation: PixiMainSceneDropPresentation;
		readonly previewResult: readTileDropPreviewFx.Result | null;
		readonly sourceItem: TileActorItem;
		readonly surface: PixiMainSceneSurface;
		readonly target: PixiSceneDropTarget | null;
	}

	export interface Result {
		readonly command: runTileDropAtom.Command;
		readonly generation: number;
	}
}

/** Freezes release-time drop facts and registers their presentation generation. */
export const beginPixiMainSceneDropFx = Effect.fn("beginPixiMainSceneDropFx")(function* ({
	dropPresentation,
	previewResult,
	sourceItem,
	surface,
	target,
}: beginPixiMainSceneDropFx.Props) {
	const commandTarget = yield* surface.readCommandTargetFx(target);
	const expectedCollisions =
		previewResult !== null && "collisions" in previewResult
			? previewResult.collisions
			: undefined;
	const command = {
		sourceItemId: sourceItem.id,
		sourceLocation: sourceItem.location,
		sourceRevision: sourceItem.revision,
		target:
			commandTarget.kind === "slot" && expectedCollisions !== undefined
				? {
						...commandTarget,
						expectedCollisions,
					}
				: commandTarget,
	} satisfies runTileDropAtom.Command;
	const generation = yield* dropPresentation.beginFx({
		retainedActorIds: new Set([
			sourceItem.id,
			...(expectedCollisions?.map(({ itemId }) => itemId) ?? []),
		]),
		swapCandidate: null,
	});
	return {
		command,
		generation,
	} satisfies beginPixiMainSceneDropFx.Result;
});
