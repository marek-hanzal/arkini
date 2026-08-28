import { Effect } from "effect";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { DropItemResultKindEnumSchema } from "~/bridge/tile/DropItemResultKindEnumSchema";
import type { runTileDropAtom } from "~/bridge/tile/runTileDropAtom";
import type { readTileDropPreviewFx } from "~/bridge/tile/readTileDropPreviewFx";
import type { PixiMainSceneDropPresentation } from "~/ui/pixi/drop/PixiMainSceneDropPresentation";

export namespace beginDropFx {
	export interface Props {
		readonly commandTarget: runTileDropAtom.Command["target"];
		readonly dropPresentation: PixiMainSceneDropPresentation;
		readonly previewKind: readTileDropPreviewFx.Result["kind"] | null;
		readonly sourceItem: TileActorItem;
		readonly targetItem: TileActorItem | null;
	}

	export interface Result {
		readonly command: runTileDropAtom.Command;
		readonly generation: number;
	}
}

/** Freezes release-time drop facts and registers their presentation generation. */
export const beginDropFx = Effect.fn("beginDropFx")(function* ({
	commandTarget,
	dropPresentation,
	previewKind,
	sourceItem,
	targetItem,
}: beginDropFx.Props) {
	const swapCandidate =
		previewKind === DropItemResultKindEnumSchema.enum.Swap && targetItem !== null
			? {
					source: {
						id: sourceItem.id,
						location: sourceItem.location,
						revision: sourceItem.revision,
					},
					target: {
						id: targetItem.id,
						location: targetItem.location,
						revision: targetItem.revision,
					},
				}
			: null;
	const command = {
		sourceItemId: sourceItem.id,
		sourceLocation: sourceItem.location,
		sourceRevision: sourceItem.revision,
		target: commandTarget,
	} satisfies runTileDropAtom.Command;
	const generation = yield* dropPresentation.beginFx({
		sourceActorId: sourceItem.id,
		swapCandidate,
	});
	return {
		command,
		generation,
	} satisfies beginDropFx.Result;
});
