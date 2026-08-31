import type { Effect } from "effect";
import type { Container } from "pixi.js";

import type { dropItemFx } from "~/item-interaction/fx/dropItemFx";
import type { readDropItemPreviewFx } from "~/item-interaction/fx/readDropItemPreviewFx";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import type { SurfaceLayout } from "~/game-scene/type/SceneLayout";

interface MainInteractionDropTarget {
	readonly kind: "slot";
	readonly layout: SurfaceLayout;
	readonly x: number;
	readonly y: number;
}

interface MainInteractionTargetFacts {
	readonly commandTarget: dropItemFx.Props["target"];
	readonly occupant: TileActorItem | null;
	readonly stableKey: string;
	readonly target: MainInteractionDropTarget | null;
}

export interface MainInteractionSurface {
	readonly transientActorLayer: Container;
	readonly readActorPoseFx: (item: TileActorItem) => Effect.Effect<
		{
			readonly layer: Container;
			readonly size: number;
			readonly x: number;
			readonly y: number;
		} | null,
		never,
		never
	>;
	readonly readTargetFactsFx: (
		x: number,
		y: number,
	) => Effect.Effect<MainInteractionTargetFacts, never, never>;
	readonly readLocalActorIdsFx: (bounds: {
		readonly excludeActorId?: string;
		readonly height: number;
		readonly paddingRatio?: number;
		readonly width: number;
		readonly x: number;
		readonly y: number;
	}) => Effect.Effect<ReadonlyArray<string>, never, never>;
	readonly renderDropFeedbackFx: (
		target: MainInteractionDropTarget | null,
		kind: readDropItemPreviewFx.Result["kind"] | null,
	) => Effect.Effect<void, never, never>;
}
