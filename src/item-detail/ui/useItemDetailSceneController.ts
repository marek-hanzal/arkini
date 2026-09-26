import { Effect, Equal, Exit, Result } from "effect";
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
import { readItemScheduleFn } from "~/item-schedule/fn/readItemScheduleFn";
import { resolveJobQueueFx } from "~/production-job/fx/resolveJobQueueFx";
import { resolveLineStartFx } from "~/production-job/fx/resolveLineStartFx";
import { assertLineEnqueueConditionsFx } from "~/production-job/fx/assertLineEnqueueConditionsFx";
import { readLineInputAutofillCoverageFx } from "~/production-input/fx/readLineInputAutofillCoverageFx";
import { lineRulesFx } from "~/production-line/fx/lineRulesFx";
import { resolveLineShowFn } from "~/production-line/fn/resolveLineShowFn";
import { resolveLineEnableFn } from "~/production-line/fn/resolveLineEnableFn";
import { readLineBlockingHintFn } from "~/item-detail-read/fn/readLineBlockingHintFn";
import { isItemProductionAdmissionOpenFn } from "~/production-line/fn/isItemProductionAdmissionOpenFn";
import { LineTriggerEnumSchema } from "~/production-line/schema/LineTriggerEnumSchema";
import { readEffectiveLineFn } from "~/production-line/fn/readEffectiveLineFn";
import type { LineSchema } from "~/production-line/schema/LineSchema";

export namespace useItemDetailSceneController {
	export interface Props {
		readonly target: ItemDetailTarget;
	}
	export interface Detail extends Pick<ItemSchema.Type, "description" | "lines" | "ui"> {
		readonly canMake: boolean;
		readonly disabledLineUids: readonly string[];
		readonly lineBlockingHints: Readonly<Record<string, string | undefined>>;
		readonly materialReadyLineUids: readonly string[];
		readonly playReadyLineUids: readonly string[];
		readonly defaultLine?: LineSchema.Type;
		readonly defaultLineDisabled: boolean;
		readonly defaultLineBlockingHint?: string;
		readonly defaultLinePlayReady: boolean;
		readonly title: string;
		readonly sourceUrl: string;
		readonly compositeUrl?: string;
		readonly units?: {
			readonly remaining: number;
			readonly total: number;
		};
		readonly lifetime?: {
			readonly remainingMs: number;
			readonly totalMs: number;
		};
		readonly activeJob?: {
			readonly remainingMs: number;
			readonly durationMs: number;
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
	const { kind } = target;
	const itemId = target.kind === "runtime" ? target.itemId : undefined;
	const itemUid = target.kind === "definition" ? target.itemUid : undefined;
	const [removal, setRemoval] = useState<{
		readonly itemId: string;
		readonly snapshot: readItemDetailRemovalFn.Snapshot;
	}>();
	useLayoutEffect(() => {
		if (itemId === undefined) return;
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
		removal !== undefined && removal.itemId === itemId ? removal.snapshot : undefined;
	const selectorFn = useCallback(
		(runtime: RuntimeSchema.Type): useItemDetailSceneController.Detail | undefined => {
			const runtimeItem =
				kind === "runtime"
					? (runtime.items.find((candidate) => candidate.id === itemId) ??
						finalSnapshot?.snapshot)
					: undefined;
			const item = itemUid === undefined ? runtimeItem?.item : game.config.items[itemUid];
			if (item === undefined) return undefined;
			const boardLocation =
				runtimeItem?.location.scope === "board" && finalSnapshot === undefined
					? runtimeItem.location
					: undefined;
			const boardOwnerItemId = boardLocation === undefined ? undefined : runtimeItem?.id;
			const productionLines = item.lines.filter(
				(line) => line.trigger === LineTriggerEnumSchema.enum.manual,
			);
			const lineStates = game.readFn(
				Effect.forEach(productionLines, (line) => {
					// Only a live Board owner supplies a physical origin for visibility rules.
					if (boardLocation === undefined || boardOwnerItemId === undefined)
						return Effect.succeed({
							line,
							visible: line.show,
							enabled: line.enable,
							blockingHint: undefined,
							materialsAvailable: false,
							playReady: false,
						});
					return Effect.gen(function* () {
						const rules = yield* lineRulesFx({
							origin: boardLocation,
							rules: line.rules,
						});
						const visible = resolveLineShowFn({
							line,
							rules,
						});
						const enabled = resolveLineEnableFn({
							line,
							rules,
						});
						const materialsAvailable =
							visible &&
							enabled &&
							line.input.some((input) => input.type === "materials")
								? (yield* readLineInputAutofillCoverageFx({
										ownerItemId: boardOwnerItemId,
										lineUid: line.uid,
										runtime,
									})).type === "complete"
								: false;
						let playReady = false;
						if (
							visible &&
							enabled &&
							runtimeItem !== undefined &&
							isItemProductionAdmissionOpenFn(runtimeItem) &&
							(!line.input.some((input) => input.type === "materials") ||
								materialsAvailable)
						) {
							const start = yield* resolveLineStartFx({
								ownerItemId: boardOwnerItemId,
								lineUid: line.uid,
								runtime,
							});
							if (
								start.queue.available &&
								start.run.input.every(
									({ resolution }) =>
										resolution.type === "materials" || resolution.ready,
								)
							) {
								playReady = Result.isSuccess(
									yield* Effect.result(
										assertLineEnqueueConditionsFx({
											resolution: start,
											runtime,
										}),
									),
								);
							}
						}
						return {
							line,
							blockingHint: readLineBlockingHintFn({
								line,
								rules,
							}),
							visible,
							enabled,
							materialsAvailable,
							playReady,
						};
					});
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
			const defaultLine =
				runtimeItem === undefined
					? item.lines.find((line) => line.default)
					: readEffectiveLineFn({
							ownerItemId: runtimeItem.id,
							ownerItem: item,
							runtime,
						});
			const defaultLineState = lineStates.value.find(
				(state) => state.line.uid === defaultLine?.uid,
			);
			let canMake = false;
			if (
				runtimeItem?.location.scope === "board" &&
				finalSnapshot === undefined &&
				item.ui === "default" &&
				productionLines.length > 0
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
			const lifetimeDurationMs = readItemScheduleFn(item)?.durationMs;
			const activeJob = runtime.jobs.find((job) => job.ownerItemId === runtimeItem?.id);
			return {
				defaultLine,
				defaultLineDisabled:
					defaultLineState === undefined ||
					!defaultLineState.visible ||
					!defaultLineState.enabled,
				defaultLineBlockingHint: defaultLineState?.blockingHint,
				defaultLinePlayReady: defaultLineState?.playReady ?? false,
				lines: visibleLines.map((state) => state.line),
				lineBlockingHints: Object.fromEntries(
					visibleLines.map((state) => [
						state.line.uid,
						state.blockingHint,
					]),
				),
				materialReadyLineUids: visibleLines
					.filter((state) => state.materialsAvailable)
					.map((state) => state.line.uid),
				playReadyLineUids: visibleLines
					.filter((state) => state.playReady)
					.map((state) => state.line.uid),
				disabledLineUids: visibleLines
					.filter((state) => !state.enabled)
					.map((state) => state.line.uid),
				canMake,
				ui: item.ui,
				title: item.title,
				sourceUrl: game.getResourceUrlFn(item.artwork.default[0]),
				compositeUrl:
					item.artwork.default[1] === undefined
						? undefined
						: game.getResourceUrlFn(item.artwork.default[1]),
				description: item.description,
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
				lifetime:
					lifetimeDurationMs === undefined
						? undefined
						: {
								remainingMs:
									runtimeItem?.schedule?.remainingDurationMs ??
									lifetimeDurationMs,
								totalMs: lifetimeDurationMs,
							},
				activeJob:
					activeJob === undefined
						? undefined
						: {
								remainingMs: activeJob.remainingMs,
								durationMs: activeJob.durationMs,
							},
			};
		},
		[
			game,
			kind,
			itemId,
			itemUid,
			finalSnapshot,
		],
	);
	const detail = useRuntimeSelector(game, selectorFn, Equal.equals);
	const retained = useRetainedItemDetailProjection({
		available: detail !== undefined,
		targetKey: `${kind}:${itemId ?? itemUid}`,
		value: detail,
	});
	return {
		detail: retained.value,
		stale: finalSnapshot !== undefined || retained.stale,
		removalReason: finalSnapshot?.reason,
	};
};
