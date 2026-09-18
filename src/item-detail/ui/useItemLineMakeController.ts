import { useAtom } from "@effect/atom-react";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useMemo } from "react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";

export namespace useItemLineMakeController {
	export interface Props {
		readonly ownerItemId?: IdSchema.Type;
		readonly lineId: IdSchema.Type;
		readonly disabled: boolean;
	}
	export interface Output {
		readonly makeFn: () => void;
		readonly pending: boolean;
	}
}

/** Submits one exact line to the canonical queue; admission remains an engine decision. */
export const useItemLineMakeController = ({
	ownerItemId,
	lineId,
	disabled,
}: useItemLineMakeController.Props): useItemLineMakeController.Output => {
	const game = useGameEngine();
	const commandAtom = useMemo(
		() => Atom.fn((props: enqueueLineFx.Props) => game.runFx(enqueueLineFx(props))),
		[
			game,
			ownerItemId,
			lineId,
		],
	);
	const [result, enqueueFn] = useAtom(commandAtom);
	// Admission can race a Tick; typed rejection leaves the queue unchanged and shows no message.
	RendererRuntime.runSync(readSettledAsyncResultErrorFx(result));
	return {
		makeFn: () => {
			if (disabled || result.waiting || ownerItemId === undefined) return;
			enqueueFn({
				ownerItemId,
				lineId,
			});
		},
		pending: result.waiting,
	};
};
