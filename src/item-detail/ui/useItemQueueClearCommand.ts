import { useAtom } from "@effect/atom-react";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useMemo } from "react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { clearItemJobQueueFx } from "~/production-job/fx/clearItemJobQueueFx";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";

/** Owns queue-clear command settlement and resets command state with the displayed target. */
export const useItemQueueClearCommand = (
	ownerItemId: IdSchema.Type | undefined,
	requestId?: IdSchema.Type,
) => {
	const game = useGameEngine();
	const commandAtom = useMemo(
		() => Atom.fn((props: clearItemJobQueueFx.Props) => game.runFx(clearItemJobQueueFx(props))),
		[
			game,
			ownerItemId,
			requestId,
		],
	);
	const [result, clearQueueFn] = useAtom(commandAtom);
	RendererRuntime.runSync(readSettledAsyncResultErrorFx(result));
	return {
		clearQueueFn,
		waiting: result.waiting,
	};
};
