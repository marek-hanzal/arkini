import { Equal } from "effect";
import { useCallback, useEffect } from "react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { readItemDetailInfoFn } from "~/item-detail-read/fn/readItemDetailInfoFn";
import { readItemDetailIdentityFx } from "~/item-detail-read/fx/readItemDetailIdentityFx";
import type { ItemDetailTarget } from "~/item-detail-frame/type/ItemDetailControl";
import { useItemDetailControl } from "~/item-detail-frame/ui/useItemDetailControl";
import { useRetainedItemDetailProjection } from "~/item-detail-frame/ui/useRetainedItemDetailProjection";
import {
	type ItemDetailQueueProjection,
	projectItemDetailQueueFx,
} from "~/item-detail/fx/projectItemDetailQueueFx";
import { useItemDetailNavigationController } from "~/item-detail/ui/useItemDetailNavigationController";
import type { ItemDetailLinesProjection } from "~/item-line-detail/type/ItemDetailLinesProjection";
import { useItemDetailLines } from "~/item-line-detail/ui/useItemDetailLines";
import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import { useRuntimeSelector } from "~/game-presentation/ui/useRuntimeSelector";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

const unavailable = {
	kind: "unavailable",
} as const;

export namespace useRuntimeItemDetailSceneController {
	export type Target = Extract<
		ItemDetailTarget,
		{
			readonly kind: "runtime";
		}
	>;

	export type IdentityProjection =
		| {
				readonly kind: "available";
				readonly definitionId: IdSchema.Type;
				readonly itemId: IdSchema.Type;
				readonly title: string;
				readonly sourceUrl: string;
				readonly compositeUrl?: string;
		  }
		| {
				readonly kind: "unavailable";
		  };

	export interface Props {
		readonly target: Target;
	}

	export interface Output {
		readonly identity?: IdentityProjection;
		readonly info?: readItemDetailInfoFn.Result;
		readonly lineCount?: number;
		readonly lines?: ItemDetailLinesProjection.Projection;
		readonly queue?: ItemDetailQueueProjection;
		readonly queueCount?: number;
		readonly queueStale: boolean;
		readonly sources?: useItemDetailNavigationController.SourcesProjection;
		readonly stale: boolean;
		readonly tabs: useItemDetailNavigationController.Output["tabs"];
	}
}

const useItemDetailIdentity = (
	itemId: IdSchema.Type,
): useRuntimeItemDetailSceneController.IdentityProjection => {
	const game = useGameEngine();
	const selectorFn = useCallback(
		(runtime: RuntimeSchema.Type): useRuntimeItemDetailSceneController.IdentityProjection => {
			const identity = game.readOrThrowFn(
				readItemDetailIdentityFx({
					itemId,
					runtime,
				}),
			);
			if (identity.kind === "unavailable") return unavailable;
			return {
				kind: "available",
				definitionId: identity.definitionId,
				itemId: identity.itemId,
				title: identity.title,
				sourceUrl: game.getResourceUrlFn(identity.sourceResourceIds[0]),
				...(identity.sourceResourceIds[1] === undefined
					? {}
					: {
							compositeUrl: game.getResourceUrlFn(identity.sourceResourceIds[1]),
						}),
			};
		},
		[
			game,
			itemId,
		],
	);
	return useRuntimeSelector(game, selectorFn, Equal.equals);
};

const useItemDetailInfo = (itemId: IdSchema.Type): readItemDetailInfoFn.Result => {
	const game = useGameEngine();
	const selectorFn = useCallback(
		(runtime: RuntimeSchema.Type): readItemDetailInfoFn.Result =>
			readItemDetailInfoFn({
				itemId,
				runtime,
			}),
		[
			itemId,
		],
	);
	return useRuntimeSelector(game, selectorFn, (left, right) => {
		if (left.kind !== right.kind) return false;
		if (left.kind === "unavailable" || right.kind === "unavailable") return true;
		return (
			left.itemId === right.itemId &&
			left.description === right.description &&
			left.itemType === right.itemType &&
			left.storageScope === right.storageScope &&
			left.location.kind === right.location.kind &&
			(left.location.kind !== "board" ||
				right.location.kind !== "board" ||
				left.location.space === right.location.space) &&
			left.quantity === right.quantity &&
			left.maxStackSize === right.maxStackSize &&
			left.ownedQuantity === right.ownedQuantity &&
			left.maxCount === right.maxCount &&
			left.charges?.remaining === right.charges?.remaining &&
			left.charges?.total === right.charges?.total
		);
	});
};

const useItemDetailQueue = (itemId: IdSchema.Type): ItemDetailQueueProjection => {
	const game = useGameEngine();
	const selectorFn = useCallback(
		(runtime: RuntimeSchema.Type): ItemDetailQueueProjection =>
			game.readOrThrowFn(
				projectItemDetailQueueFx({
					game,
					itemId,
					runtime,
				}),
			),
		[
			game,
			itemId,
		],
	);
	return useRuntimeSelector(game, selectorFn, Equal.equals);
};

/** Composes the live and retained projections for one runtime Item Detail scene. */
export const useRuntimeItemDetailSceneController = ({
	target,
}: useRuntimeItemDetailSceneController.Props): useRuntimeItemDetailSceneController.Output => {
	const itemDetail = useItemDetailControl();
	const liveIdentity = useItemDetailIdentity(target.itemId);
	const liveInfo = useItemDetailInfo(target.itemId);
	const liveLines = useItemDetailLines(target.itemId);
	const liveQueue = useItemDetailQueue(target.itemId);
	const navigation = useItemDetailNavigationController({
		target: {
			kind: "runtime",
			itemId: target.itemId,
		},
	});
	const targetKey = `runtime:${target.itemId}`;
	const retainedIdentity = useRetainedItemDetailProjection({
		available: liveIdentity.kind === "available",
		targetKey,
		value: liveIdentity,
	});
	const retainedTabs = useRetainedItemDetailProjection({
		available: navigation.tabs.length > 0,
		targetKey,
		value: navigation.tabs,
	});
	const retainedInfo = useRetainedItemDetailProjection({
		available: liveInfo.kind === "available",
		targetKey,
		value: liveInfo,
	});
	const retainedLines = useRetainedItemDetailProjection({
		available: liveLines.kind === "available",
		targetKey,
		value: liveLines,
	});
	const retainedQueue = useRetainedItemDetailProjection({
		available: liveQueue.kind === "available",
		targetKey,
		value: liveQueue,
	});
	const retainedSources = useRetainedItemDetailProjection({
		available: navigation.sources.kind === "available",
		targetKey,
		value: navigation.sources,
	});
	const tabs = retainedTabs.value ?? [];
	const stale = retainedIdentity.stale || retainedTabs.stale;

	useEffect(() => {
		if (stale || navigation.tabs.includes(target.tab)) return;
		RendererRuntime.runSync(
			itemDetail.openItemDetailFx({
				itemId: target.itemId,
			}),
		);
	}, [
		itemDetail,
		navigation.tabs,
		stale,
		target.itemId,
		target.tab,
	]);

	return {
		identity: retainedIdentity.value,
		info: retainedInfo.value,
		lineCount:
			retainedLines.value?.kind === "available" ? retainedLines.value.line.length : undefined,
		lines: retainedLines.value,
		queue: retainedQueue.value,
		queueCount: liveQueue.kind === "available" ? liveQueue.request.length : undefined,
		queueStale: retainedQueue.stale,
		sources: retainedSources.value,
		stale,
		tabs,
	};
};
