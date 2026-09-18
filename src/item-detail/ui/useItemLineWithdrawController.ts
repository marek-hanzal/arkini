import { useAtom } from "@effect/atom-react";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useMemo } from "react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { withdrawLineInputFx } from "~/production-input/fx/withdrawLineInputFx";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";

export namespace useItemLineWithdrawController {
	export interface Props {
		readonly ownerItemId?: IdSchema.Type;
		readonly lineId: IdSchema.Type;
		readonly disabled: boolean;
	}
	export interface Output {
		readonly withdrawFn: (inputIndex: number) => void;
		readonly pending: boolean;
	}
}

/** Returns one buffered piece through the existing input withdrawal transaction. */
export const useItemLineWithdrawController = ({
	ownerItemId,
	lineId,
	disabled,
}: useItemLineWithdrawController.Props): useItemLineWithdrawController.Output => {
	const game = useGameEngine();
	const commandAtom = useMemo(
		() => Atom.fn((props: withdrawLineInputFx.Props) => game.runFx(withdrawLineInputFx(props))),
		[
			game,
			ownerItemId,
			lineId,
		],
	);
	const [result, withdrawFn] = useAtom(commandAtom);
	// A Tick may commit or expire the material before the click; typed rejection leaves it untouched.
	RendererRuntime.runSync(readSettledAsyncResultErrorFx(result));
	return {
		withdrawFn: (inputIndex) => {
			if (disabled || result.waiting || ownerItemId === undefined) return;
			withdrawFn({
				ownerItemId,
				lineId,
				inputIndex,
				amount: "one",
			});
		},
		pending: result.waiting,
	};
};
