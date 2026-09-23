import { Effect } from "effect";
import { match } from "ts-pattern";

import { DropItemResultKind } from "~/item-interaction/type/DropItemResult";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";
import type { GameEngine } from "~/playable-game/type/GameEngine";
import type { readDropItemPreviewFx } from "~/item-interaction/fx/readDropItemPreviewFx";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import { isSameTileActorLocationFn } from "~/tile-rendering/fn/isSameTileActorLocationFn";
import { readActorCursorFn } from "~/tile-rendering/fn/readActorCursorFn";
import type { MainActorStore } from "~/tile-rendering/service/MainActorStore";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import { readTileDropPreviewFx } from "~/tile-interaction/fx/readTileDropPreviewFx";
import type {
	MainInteractionSurface,
	MainInteractionTargetFacts as TargetFacts,
} from "~/tile-interaction/type/MainInteractionSurface";

export namespace createMainDragPreviewFx {
	export interface State {
		readonly actor: PixiTileActor;
		readonly sourceItem: TileActorItem;
		previewKind: readDropItemPreviewFx.Result["kind"] | null;
		previewSource: Pick<TileActorItem, "id" | "location" | "revision"> | null;
		target: NonNullable<TargetFacts["target"]> | null;
		targetKey: string;
		targetItem: TileActorItem | null;
	}

	export interface Output {
		readonly clearTargetFx: Effect.Effect<void, never, never>;
		readonly detachTargetFx: (actor: PixiTileActor) => Effect.Effect<void, never, never>;
		readonly previewTargetFx: (props: {
			readonly drag: State;
			readonly force?: boolean;
			readonly targetFacts: TargetFacts;
		}) => Effect.Effect<TileActorItem | null, never, never>;
		readonly readCurrentSourceFx: (
			drag: State,
		) => Effect.Effect<TileActorItem | null, never, never>;
		readonly readPreviewKindFx: (props: {
			readonly sourceItem: TileActorItem;
			readonly targetFacts: TargetFacts;
		}) => Effect.Effect<readDropItemPreviewFx.Result["kind"], never, never>;
	}
}

interface Props {
	readonly actorStore: MainActorStore;
	readonly animator: ActorAnimator;
	readonly game: GameEngine;
	readonly surface: MainInteractionSurface;
}

/** Owns canonical source rebasing and engine preview projection. */
export const createMainDragPreviewFx = Effect.fn("createMainDragPreviewFx")(function* ({
	actorStore,
	animator,
	game,
	surface,
}: Props) {
	let previewTarget: PixiTileActor | null = null;
	let previewFactor = 1;

	const setTargetFx = Effect.fn("MainDragPreview.setTargetFx")(function* (
		target: PixiTileActor | null,
		factor = 1,
	) {
		if (previewTarget === target && previewFactor === factor) return;
		const previous = previewTarget;
		previewTarget = target;
		previewFactor = factor;
		if (previous !== target && previous !== null && !previous.container.destroyed) {
			yield* animator.animateFx({
				actor: previous,
				channel: "drop-target",
				curve: {
					kind: "spring",
					bounce: 0,
				},
				durationMs: 260,
				toFactor: 1,
			});
		}
		if (target !== null) {
			yield* animator.animateFx({
				actor: target,
				channel: "drop-target",
				curve: {
					kind: "spring",
					bounce: 0,
				},
				durationMs: 260,
				toFactor: factor,
			});
		}
	});
	const projectTargetFx = Effect.fn("MainDragPreview.projectTargetFx")(function* (
		drag: createMainDragPreviewFx.State,
	) {
		const factor = match(drag.previewKind)
			.with(DropItemResultKind.Reject, DropItemResultKind.Swap, () => 0.8)
			.with(DropItemResultKind.Merge, () => 1.08)
			.with(null, DropItemResultKind.Ignored, DropItemResultKind.Move, () => 1)
			.exhaustive();
		const actor =
			factor !== 1 && drag.targetItem !== null
				? (actorStore.actors.get(drag.targetItem.id) ?? null)
				: null;
		yield* setTargetFx(
			actor !== null && actor !== drag.actor && !actor.container.destroyed ? actor : null,
			factor,
		);
	});

	const readCurrentSourceFx = Effect.fn("MainDragPreview.readCurrentSourceFx")(function* (
		drag: createMainDragPreviewFx.State,
	) {
		if (
			drag.actor.container.destroyed ||
			actorStore.actors.get(drag.sourceItem.id) !== drag.actor
		) {
			return null;
		}
		const canonical = actorStore.canonicalItems.get(drag.sourceItem.id);
		if (
			canonical === undefined ||
			!isSameTileActorLocationFn(canonical.location, drag.sourceItem.location)
		) {
			return null;
		}
		return {
			...drag.actor.item,
			location: canonical.location,
			revision: canonical.revision,
		} satisfies TileActorItem;
	});

	const readPreviewKindFx = Effect.fn("MainDragPreview.readPreviewKindFx")(
		({
			sourceItem,
			targetFacts,
		}: {
			readonly sourceItem: TileActorItem;
			readonly targetFacts: TargetFacts;
		}) =>
			readTileDropPreviewFx({
				game,
				sourceItemId: sourceItem.id,
				sourceLocation: sourceItem.location,
				sourceRevision: sourceItem.revision,
				target: targetFacts.commandTarget,
			}).pipe(Effect.map(({ kind }) => kind)),
	);

	const previewTargetFx = Effect.fn("MainDragPreview.previewTargetFx")(function* ({
		drag,
		force = false,
		targetFacts,
	}: {
		readonly drag: createMainDragPreviewFx.State;
		readonly force?: boolean;
		readonly targetFacts: TargetFacts;
	}) {
		const sourceItem = yield* readCurrentSourceFx(drag);
		if (sourceItem === null) {
			drag.target = targetFacts.target;
			drag.targetKey = targetFacts.stableKey;
			drag.targetItem = null;
			drag.previewKind = null;
			drag.previewSource = null;
			yield* setTargetFx(null);
			yield* surface.renderDropFeedbackFx(null, null);
			return null;
		}
		if (
			!force &&
			drag.targetKey === targetFacts.stableKey &&
			drag.previewSource !== null &&
			drag.previewSource.id === sourceItem.id &&
			drag.previewSource.revision === sourceItem.revision &&
			isSameTileActorLocationFn(drag.previewSource.location, sourceItem.location)
		) {
			yield* projectTargetFx(drag);
			return sourceItem;
		}
		const kind = yield* readPreviewKindFx({
			sourceItem,
			targetFacts,
		});
		drag.target = targetFacts.target;
		drag.targetKey = targetFacts.stableKey;
		drag.targetItem = targetFacts.occupant;
		drag.previewKind = kind;
		drag.previewSource = {
			id: sourceItem.id,
			location: sourceItem.location,
			revision: sourceItem.revision,
		};
		drag.actor.container.cursor = readActorCursorFn({
			hasDropTarget: targetFacts.target !== null,
			phase: "dragging",
			running: sourceItem.running,
		});
		yield* projectTargetFx(drag);
		yield* surface.renderDropFeedbackFx(targetFacts.target, kind);
		return sourceItem;
	});

	return {
		clearTargetFx: setTargetFx(null),
		detachTargetFx: Effect.fn("MainDragPreview.detachTargetFx")(function* (
			actor: PixiTileActor,
		) {
			if (previewTarget === actor) previewTarget = null;
			// A departing actor must not retain a partial hover response when its animations stop.
			yield* animator.setFx({
				actor,
				channel: "drop-target",
				factor: 1,
			});
		}),
		previewTargetFx,
		readCurrentSourceFx,
		readPreviewKindFx,
	} satisfies createMainDragPreviewFx.Output;
});
