import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { match } from "ts-pattern";

import type { useTileActors } from "~/bridge/tile/useTileActors";
import type { TileInteractionState } from "~/ui/tile/TileInteractionState";

const targetActorId = (
	target: Extract<
		TileInteractionState,
		{
			readonly phase: "dragging" | "awaiting-outcome";
		}
	>["target"],
) => (target?.kind === "slot" ? (target.occupant?.id ?? null) : null);

const protectedActorIds = (active: TileInteractionState | null): ReadonlySet<string> =>
	match(active)
		.with(null, () => new Set<string>())
		.with(
			{
				phase: "pressed",
			},
			({ source }) =>
				new Set([
					source.id,
				]),
		)
		.with(
			{
				phase: "dragging",
			},
			({ source, target }) => {
				const ids = new Set([
					source.id,
				]);
				const targetId = targetActorId(target);
				if (targetId !== null) ids.add(targetId);
				return ids;
			},
		)
		.with(
			{
				phase: "awaiting-outcome",
			},
			({ source, target }) => {
				const ids = new Set([
					source.id,
				]);
				const targetId = targetActorId(target);
				if (targetId !== null) ids.add(targetId);
				return ids;
			},
		)
		.with(
			{
				phase: "settling",
				settlement: {
					kind: "merge",
					stage: "approach",
				},
			},
			({ settlement }) =>
				new Set([
					settlement.outcome.source.itemId,
					settlement.outcome.target.itemId,
				]),
		)
		.with(
			{
				phase: "settling",
			},
			({ settlement }) => new Set(settlement.pendingActorIds),
		)
		.exhaustive();

/** Retains only visual snapshots explicitly owned by the active presentation generation. */
export const useRetainedTileActors = ({
	active,
	liveItems,
}: {
	readonly active: TileInteractionState | null;
	readonly liveItems: ReadonlyArray<useTileActors.Item>;
}) => {
	const liveItemsRef = useRef(liveItems);
	const [retainedItems, setRetainedItems] = useState(() => new Map<string, useTileActors.Item>());
	const liveItemsById = useMemo(
		() =>
			new Map(
				liveItems.map(
					(item) =>
						[
							item.id,
							item,
						] as const,
				),
			),
		[
			liveItems,
		],
	);

	useLayoutEffect(() => {
		liveItemsRef.current = liveItems;
	}, [
		liveItems,
	]);

	const retainActorIds = useCallback((itemIds: ReadonlyArray<string>) => {
		setRetainedItems((current) => {
			const liveById = new Map(
				liveItemsRef.current.map(
					(item) =>
						[
							item.id,
							item,
						] as const,
				),
			);
			const next = new Map(current);
			for (const itemId of itemIds) {
				const snapshot = liveById.get(itemId);
				if (snapshot !== undefined) next.set(itemId, snapshot);
			}
			return next;
		});
	}, []);

	useLayoutEffect(() => {
		const protectedIds = protectedActorIds(active);
		setRetainedItems((current) => {
			const next = new Map<string, useTileActors.Item>();
			for (const itemId of protectedIds) {
				const snapshot = liveItemsById.get(itemId) ?? current.get(itemId);
				if (snapshot !== undefined) next.set(itemId, snapshot);
			}
			if (
				next.size === current.size &&
				Array.from(next).every(([itemId, item]) => current.get(itemId) === item)
			) {
				return current;
			}
			return next;
		});
	}, [
		active,
		liveItemsById,
	]);

	const missingRetainedItems = useMemo(
		() => Array.from(retainedItems.values()).filter((item) => !liveItemsById.has(item.id)),
		[
			liveItemsById,
			retainedItems,
		],
	);

	return {
		retainedItems: missingRetainedItems,
		retainActorIds,
	};
};
