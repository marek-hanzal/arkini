import { useAtom } from "@effect/atom-react";
import { Equal } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useCallback, useMemo } from "react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import { useRuntimeSelector } from "~/game-presentation/ui/useRuntimeSelector";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { readEffectiveLineFn } from "~/production-line/fn/readEffectiveLineFn";
import { setLineSelectionFx } from "~/production-line/fx/setLineSelectionFx";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";

export namespace useItemLineDefaultController {
	export interface Props {
		readonly ownerItemId?: IdSchema.Type;
		readonly lineUid: IdSchema.Type;
		readonly authoredDefault: boolean;
		readonly disabled: boolean;
	}
	export interface Output {
		readonly selected: boolean;
		readonly disabled: boolean;
		readonly toggleFn: () => void;
	}
}

/** Toggles the exact owner's default role, independently of queue capacity and Clock selection. */
export const useItemLineDefaultController = ({
	ownerItemId,
	lineUid,
	authoredDefault,
	disabled,
}: useItemLineDefaultController.Props): useItemLineDefaultController.Output => {
	const game = useGameEngine();
	const selectorFn = useCallback(
		(runtime: RuntimeSchema.Type) => {
			const owner = runtime.items.find((item) => item.id === ownerItemId);
			if (owner === undefined)
				return {
					selected: authoredDefault,
					controllable: false,
				};
			return {
				selected:
					readEffectiveLineFn({
						ownerItemId: owner.id,
						ownerItem: owner.item,
						runtime,
					})?.uid === lineUid,
				controllable: owner.location.scope === "board",
			};
		},
		[
			game,
			ownerItemId,
			lineUid,
			authoredDefault,
		],
	);
	const state = useRuntimeSelector(game, selectorFn, Equal.equals);
	const commandAtom = useMemo(
		() => Atom.fn((props: setLineSelectionFx.Props) => game.runFx(setLineSelectionFx(props))),
		[
			game,
			ownerItemId,
			lineUid,
		],
	);
	const [result, selectFn] = useAtom(commandAtom);
	RendererRuntime.runSync(readSettledAsyncResultErrorFx(result));
	const unavailable = disabled || !state.controllable || result.waiting;
	return {
		selected: state.selected,
		disabled: unavailable,
		toggleFn: () => {
			if (unavailable || ownerItemId === undefined) return;
			selectFn({
				ownerItemId,
				lineUid: state.selected ? null : lineUid,
				selection: "default",
			});
		},
	};
};
