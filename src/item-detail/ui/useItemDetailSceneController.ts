import { Effect, Equal, Exit } from "effect";
import { useCallback, useLayoutEffect, useState } from "react";

import { readItemDetailRemovalFn } from "~/item-detail-read/fn/readItemDetailRemovalFn";
import type { ItemDetailTarget } from "~/item-detail-frame/type/ItemDetailControl";
import { useRetainedItemDetailProjection } from "~/item-detail-frame/ui/useRetainedItemDetailProjection";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import { useRuntimeSelector } from "~/game-presentation/ui/useRuntimeSelector";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import { readItemRemainingUnitsFn } from "~/production-action/fn/readItemRemainingUnitsFn";
import { canControlItemProductionFn } from "~/production-line/fn/canControlItemProductionFn";
import { resolveJobQueueFx } from "~/production-job/fx/resolveJobQueueFx";
import { lineRulesFx } from "~/production-line/fx/lineRulesFx";
import { resolveLineShowFn } from "~/production-line/fn/resolveLineShowFn";
import { resolveLineEnableFn } from "~/production-line/fn/resolveLineEnableFn";
import { readLineBlockingHintFn } from "~/item-detail-read/fn/readLineBlockingHintFn";

export namespace useItemDetailSceneController {
	export interface Props {
		readonly target: ItemDetailTarget;
	}
	export interface Detail
		extends Pick<ItemSchema.Type, "description" | "maxStackSize" | "lines" | "ui"> {
		readonly canMake: boolean;
		readonly disabledLineIds: readonly string[];
		readonly lineBlockingHints: Readonly<Record<string, string | undefined>>;
		readonly title: string;
		readonly sourceUrl: string;
		readonly compositeUrl?: string;
		readonly units?: {
			readonly remaining: number;
			readonly total: number;
		};
	}
	export interface Output {
		readonly detail?: Detail;
		readonly stale: boolean;
		readonly removalReason?: readItemDetailRemovalFn.Snapshot["reason"];
	}
}

/** Keeps identity and basic authored facts together for the exact visible item. */
export const useItemDetailSceneController = ({
	target,
}: useItemDetailSceneController.Props): useItemDetailSceneController.Output => {
	const game = useGameEngine();
	const { kind, itemId } = target;
	const [removal, setRemoval] = useState<{
		readonly itemId: string;
		readonly snapshot: readItemDetailRemovalFn.Snapshot;
	}>();
	useLayoutEffect(() => {
		if (kind !== "runtime") return;
		// Observe every commit, even when React batches several runtime renders together.
		return game.subscribeTransitionsFn((transition) => {
			const snapshot = readItemDetailRemovalFn(transition, itemId);
			if (snapshot !== undefined)
				setRemoval({
					itemId,
					snapshot,
				});
			else if (transition.runtime.items.some((item) => item.id === itemId))
				setRemoval(undefined);
		});
	}, [
		game,
		kind,
		itemId,
	]);
	const finalSnapshot =
		kind === "runtime" && removal?.itemId === itemId ? removal.snapshot : undefined;
	const selectorFn = useCallback(
		(runtime: RuntimeSchema.Type): useItemDetailSceneController.Detail | undefined => {
			const runtimeItem =
				kind === "runtime"
					? (runtime.items.find((candidate) => candidate.id === itemId) ??
						finalSnapshot?.snapshot)
					: undefined;
			const item = kind === "definition" ? game.config.items[itemId] : runtimeItem?.item;
			if (item === undefined) return undefined;
			const lineStates = game.readFn(
				Effect.forEach(item.lines, (line) => {
					// Only a live Board owner supplies a physical origin for visibility rules.
					if (runtimeItem?.location.scope !== "board" || finalSnapshot !== undefined)
						return Effect.succeed({
							line,
							visible: line.show,
							enabled: line.enable,
							blockingHint: undefined,
						});
					return lineRulesFx({
						origin: runtimeItem.location,
						rules: line.rules,
					}).pipe(
						Effect.map((rules) => ({
							line,
							blockingHint: readLineBlockingHintFn({
								line,
								rules,
							}),
							visible: resolveLineShowFn({
								line,
								rules,
							}),
							enabled: resolveLineEnableFn({
								line,
								rules,
							}),
						})),
					);
				}).pipe(
					Effect.provideService(RuntimeFx, {
						read: Effect.succeed(runtime),
					}),
				),
			);
			if (Exit.isFailure(lineStates)) throw lineStates.cause;
			const visibleLines = lineStates.value
				.filter((state) => state.visible)
				.sort((a, b) => Number(b.enabled) - Number(a.enabled));
			let canMake = false;
			if (
				runtimeItem?.location.scope === "board" &&
				finalSnapshot === undefined &&
				item.lines.length > 0 &&
				canControlItemProductionFn(item)
			) {
				const queue = game.readFn(
					resolveJobQueueFx({
						runtime,
						owner: runtimeItem,
					}),
				);
				if (Exit.isFailure(queue)) throw queue.cause;
				canMake = queue.value.available;
			}
			return {
				lines: visibleLines.map((state) => state.line),
				lineBlockingHints: Object.fromEntries(
					visibleLines.map((state) => [
						state.line.id,
						state.blockingHint,
					]),
				),
				disabledLineIds: visibleLines
					.filter((state) => !state.enabled)
					.map((state) => state.line.id),
				canMake,
				ui: item.ui,
				title: item.title,
				sourceUrl: game.getResourceUrlFn(item.artwork.default[0]),
				compositeUrl:
					item.artwork.default[1] === undefined
						? undefined
						: game.getResourceUrlFn(item.artwork.default[1]),
				description: item.description,
				maxStackSize: item.maxStackSize,
				units:
					item.units === undefined
						? undefined
						: {
								remaining:
									runtimeItem === undefined
										? item.units.amount
										: (readItemRemainingUnitsFn(runtimeItem) ??
											item.units.amount),
								total: item.units.amount,
							},
			};
		},
		[
			game,
			kind,
			itemId,
			finalSnapshot,
		],
	);
	const detail = useRuntimeSelector(game, selectorFn, Equal.equals);
	const retained = useRetainedItemDetailProjection({
		available: detail !== undefined,
		targetKey: `${kind}:${itemId}`,
		value: detail,
	});
	return {
		detail: retained.value,
		stale: finalSnapshot !== undefined || retained.stale,
		removalReason: finalSnapshot?.reason,
	};
};
