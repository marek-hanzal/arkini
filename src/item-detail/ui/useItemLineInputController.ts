import { useAtom } from "@effect/atom-react";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useMemo } from "react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { withdrawLineInputFx } from "~/production-input/fx/withdrawLineInputFx";
import { autofillLineInputFx } from "~/production-input/fx/autofillLineInputFx";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";

export namespace useItemLineInputController {
	export interface Props {
		readonly ownerItemId?: IdSchema.Type;
		readonly lineId: IdSchema.Type;
		readonly disabled: boolean;
	}
	export interface Output {
		readonly activateFn: (inputIndex: number, action: "autofill" | "withdraw") => void;
		readonly pending: boolean;
	}
}

/** Binds explicit fill/withdraw intent; the transaction rechecks the live slot before acting. */
export const useItemLineInputController = ({
	ownerItemId,
	lineId,
	disabled,
}: useItemLineInputController.Props): useItemLineInputController.Output => {
	const game = useGameEngine();
	const commandAtom = useMemo(
		() =>
			Atom.fn(
				(
					props: autofillLineInputFx.Props & {
						readonly action: "autofill" | "withdraw";
					},
				) =>
					game.runFx(
						Effect.gen(function* () {
							if (props.action === "autofill") yield* autofillLineInputFx(props);
							else
								yield* withdrawLineInputFx({
									...props,
									amount: "one",
								});
						}),
					),
			),
		[
			game,
			ownerItemId,
			lineId,
		],
	);
	const [result, activateFn] = useAtom(commandAtom);
	// A Tick may commit or expire the material before the click; typed rejection leaves it untouched.
	RendererRuntime.runSync(readSettledAsyncResultErrorFx(result));
	return {
		activateFn: (inputIndex, action) => {
			if (disabled || result.waiting || ownerItemId === undefined) return;
			activateFn({
				ownerItemId,
				lineId,
				inputIndex,
				action,
			});
		},
		pending: result.waiting,
	};
};
