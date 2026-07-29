import { Array, Effect, Option, pipe } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { ItemNotFoundError } from "~/engine/item/error/ItemNotFoundError";
import { ItemNotOnGridError } from "~/engine/item/error/ItemNotOnGridError";
import { assertRevisionFx } from "~/engine/revision/fx/assertRevisionFx";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { reviseRuntimeItemFx } from "~/engine/runtime/fx/reviseRuntimeItemFx";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { SwapSameItemError } from "~/engine/runtime/error/SwapSameItemError";
import { isBoardRuntimeItemFx } from "~/engine/runtime/read/isBoardRuntimeItemFx";
import { isGridRuntimeItemFx } from "~/engine/runtime/read/isGridRuntimeItemFx";
import { CrossSpaceBoardOperationError } from "~/engine/space/error/CrossSpaceBoardOperationError";
import type { SwapItemsResultSchema } from "~/engine/runtime/schema/command/SwapItemsResultSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
import { readGridItemDestinationFx } from "~/engine/location/read/readGridItemDestinationFx";
import { LocationOccupiedError } from "~/engine/runtime/error/LocationOccupiedError";
import { placeExactRuntimeItemFx } from "~/engine/placement/fx/placeExactRuntimeItemFx";
import { readBoardItemRectangleFx } from "~/engine/grid/fx/readBoardItemRectangleFx";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { assertDropDestinationExpectationFx } from "~/engine/runtime/read/assertDropDestinationExpectationFx";
import { readBoardRuntimeItemRectangleFx } from "~/engine/grid/fx/readBoardRuntimeItemRectangleFx";

export namespace swapItemsFx {
	export interface Props {
		expectedCollisions?: ReadonlyArray<{
			readonly itemId: IdSchema.Type;
			readonly revision: RevisionSchema.Type;
		}>;
		destinationLocation?: GridLocationSchema.Type;
		firstItemId: IdSchema.Type;
		firstItemRevision: RevisionSchema.Type;
		secondItemId: IdSchema.Type;
		secondItemRevision: RevisionSchema.Type;
	}
}

/**
 * Atomically exchanges the locations owned by two live items.
 */
export const swapItemsFx = Effect.fn("swapItemsFx")(function* ({
	expectedCollisions,
	destinationLocation,
	firstItemId,
	firstItemRevision,
	secondItemId,
	secondItemRevision,
}: swapItemsFx.Props) {
	if (firstItemId === secondItemId) {
		return yield* Effect.fail(
			new SwapSameItemError({
				itemId: firstItemId,
			}),
		);
	}

	return yield* modifyRuntimeFx((runtime) => {
		return Effect.gen(function* () {
			const runtimeFirst = pipe(
				runtime.items,
				Array.findFirst((candidate) => candidate.id === firstItemId),
				Option.getOrUndefined,
			);
			if (runtimeFirst === undefined) {
				return yield* Effect.fail(
					new ItemNotFoundError({
						itemId: firstItemId,
					}),
				);
			}
			const runtimeSecond = pipe(
				runtime.items,
				Array.findFirst((candidate) => candidate.id === secondItemId),
				Option.getOrUndefined,
			);
			if (runtimeSecond === undefined) {
				return yield* Effect.fail(
					new ItemNotFoundError({
						itemId: secondItemId,
					}),
				);
			}
			yield* assertRevisionFx({
				actualRevision: runtimeFirst.revision,
				entityId: runtimeFirst.id,
				expectedRevision: firstItemRevision,
			});
			yield* assertRevisionFx({
				actualRevision: runtimeSecond.revision,
				entityId: runtimeSecond.id,
				expectedRevision: secondItemRevision,
			});
			const first = Option.getOrUndefined(yield* isGridRuntimeItemFx(runtimeFirst));
			if (first === undefined) {
				return yield* Effect.fail(
					new ItemNotOnGridError({
						itemId: firstItemId,
						location: runtimeFirst.location,
					}),
				);
			}
			const second = Option.getOrUndefined(yield* isGridRuntimeItemFx(runtimeSecond));
			if (second === undefined) {
				return yield* Effect.fail(
					new ItemNotOnGridError({
						itemId: secondItemId,
						location: runtimeSecond.location,
					}),
				);
			}
			const boardFirst = Option.getOrUndefined(yield* isBoardRuntimeItemFx(first));
			const boardSecond = Option.getOrUndefined(yield* isBoardRuntimeItemFx(second));
			if (
				boardFirst !== undefined &&
				boardSecond !== undefined &&
				boardFirst.location.space !== boardSecond.location.space
			) {
				return yield* Effect.fail(
					new CrossSpaceBoardOperationError({
						fromSpace: boardFirst.location.space,
						toSpace: boardSecond.location.space,
					}),
				);
			}
			const firstOnBoard = boardFirst !== undefined;
			const secondOnBoard = boardSecond !== undefined;
			const boardItem = boardFirst ?? boardSecond;
			if (
				firstOnBoard !== secondOnBoard &&
				boardItem !== undefined &&
				boardItem.location.space !== runtime.currentSpace
			) {
				return yield* Effect.fail(
					new CrossSpaceBoardOperationError({
						fromSpace: runtime.currentSpace,
						toSpace: boardItem.location.space,
					}),
				);
			}

			if (
				destinationLocation !== undefined &&
				(destinationLocation.scope === "board" || boardFirst !== undefined)
			) {
				const destinationAnchor = destinationLocation;
				const expected = expectedCollisions ?? [
					{
						itemId: second.id,
						revision: second.revision,
					},
				];
				yield* assertDropDestinationExpectationFx({
					allowAdditionalOccupants: destinationAnchor.scope === "board",
					expectedCollisions: expected,
					explicitTargetItemId: second.id,
					location: destinationAnchor,
					runtime,
					source: first,
				});
				const destination = yield* readGridItemDestinationFx({
					excludedItemIds: new Set([
						first.id,
					]),
					item: first.item,
					location: destinationAnchor,
					runtime,
				});
				const collisionIds: string[] = [];
				for (const claim of destination.claims) {
					collisionIds.push(claim.itemId);
				}
				if (!collisionIds.includes(second.id)) {
					return yield* Effect.fail(
						new LocationOccupiedError({
							itemId: second.id,
							location: destinationAnchor,
						}),
					);
				}
				const displaced: GridRuntimeItemSchema.Type[] = [];
				for (const collisionId of collisionIds) {
					const collisionItem = runtime.items.find(
						(candidate) => candidate.id === collisionId,
					);
					const gridCollisionItem =
						collisionItem === undefined
							? undefined
							: Option.getOrUndefined(yield* isGridRuntimeItemFx(collisionItem));
					if (gridCollisionItem === undefined) {
						return yield* Effect.fail(
							new ItemNotOnGridError({
								itemId: collisionId,
								location: collisionItem?.location ?? runtimeFirst.location,
							}),
						);
					}
					displaced.push(gridCollisionItem);
				}
				displaced.sort((left, right) => {
					if (left.id === second.id) return -1;
					if (right.id === second.id) return 1;
					return (
						left.location.position.y - right.location.position.y ||
						left.location.position.x - right.location.position.x ||
						left.id.localeCompare(right.id)
					);
				});
				const detachedIds = new Set([
					first.id,
					...displaced.map(({ id }) => id),
				]);
				const movedFirst = yield* reviseRuntimeItemFx({
					item: {
						...first,
						location: destinationAnchor,
					},
				});
				let draft = {
					...runtime,
					items: [
						...runtime.items.filter((candidate) => !detachedIds.has(candidate.id)),
						movedFirst,
					],
				} satisfies RuntimeSchema.Type;
				const relocations: {
					readonly item: GridRuntimeItemSchema.Type;
					readonly previousLocation: GridRuntimeItemSchema.Type["location"];
				}[] = [];
				const placementOrigin =
					destinationAnchor.scope === "board" ? destinationAnchor : boardFirst?.location;
				if (placementOrigin === undefined) {
					return yield* Effect.die(
						new Error("Generalized swap relocation requires one Board origin."),
					);
				}
				const destinationRectangle =
					destinationAnchor.scope === "board"
						? yield* readBoardItemRectangleFx({
								anchor: destinationAnchor,
								item: first.item,
							})
						: boardFirst === undefined
							? yield* Effect.die(
									new Error(
										"Storage destination relocation requires a Board source.",
									),
								)
							: yield* readBoardRuntimeItemRectangleFx({
									item: boardFirst,
								});
				for (const displacedItem of displaced) {
					const placement = yield* placeExactRuntimeItemFx({
						item: displacedItem,
						origin: placementOrigin,
						originRectangle: destinationRectangle,
						preferredLocations:
							displacedItem.id === second.id
								? [
										first.location,
									]
								: [],
						runtime: draft,
					});
					draft = placement.runtime;
					relocations.push({
						item: placement.item,
						previousLocation: displacedItem.location,
					});
				}
				const relocatedSecond = relocations.find(({ item }) => item.id === second.id)?.item;
				if (relocatedSecond === undefined) {
					return yield* Effect.die(
						new Error(`Swap target ${second.id} was not relocated.`),
					);
				}
				const placedById = new Map(
					draft.items.map((item) => [
						item.id,
						item,
					]),
				);
				const orderedDraft = {
					...draft,
					items: runtime.items.map((item) => placedById.get(item.id) ?? item),
				} satisfies RuntimeSchema.Type;
				return [
					{
						first: movedFirst,
						second: relocatedSecond,
						relocations,
					} satisfies SwapItemsResultSchema.Type,
					orderedDraft,
				] as const;
			}

			const swappedFirst = yield* reviseRuntimeItemFx({
				item: {
					...first,
					location: second.location,
				} satisfies RuntimeItemSchema.Type,
			});
			const swappedSecond = yield* reviseRuntimeItemFx({
				item: {
					...second,
					location: first.location,
				} satisfies RuntimeItemSchema.Type,
			});
			const result = {
				first: swappedFirst,
				second: swappedSecond,
				relocations: [
					{
						item: swappedSecond,
						previousLocation: second.location,
					},
				],
			} satisfies SwapItemsResultSchema.Type;
			const nextRuntime = {
				...runtime,
				items: runtime.items.map((candidate) => {
					if (candidate.id === firstItemId) {
						return swappedFirst;
					}
					if (candidate.id === secondItemId) {
						return swappedSecond;
					}

					return candidate;
				}),
			} satisfies RuntimeSchema.Type;

			return [
				result,
				nextRuntime,
			] as const;
		});
	});
});
