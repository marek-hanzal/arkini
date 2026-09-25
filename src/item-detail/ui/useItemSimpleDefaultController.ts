import { useAtom } from "@effect/atom-react";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useMemo } from "react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { enqueueDefaultLineFx } from "~/production-job/fx/enqueueDefaultLineFx";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";

export namespace useItemSimpleDefaultController {
	export interface Props {
		readonly ownerItemId?: IdSchema.Type;
		readonly disabled: boolean;
	}
	export interface Output {
		readonly startFn: () => void;
		readonly pending: boolean;
	}
}

/** Submits the current effective Default line; engine admission resolves it again on click. */
export const useItemSimpleDefaultController = ({
	ownerItemId,
	disabled,
}: useItemSimpleDefaultController.Props): useItemSimpleDefaultController.Output => {
	const game = useGameEngine();
	const commandAtom = useMemo(
		() =>
			Atom.fn((props: enqueueDefaultLineFx.Props) => game.runFx(enqueueDefaultLineFx(props))),
		[
			game,
			ownerItemId,
		],
	);
	const [result, enqueueFn] = useAtom(commandAtom);
	RendererRuntime.runSync(readSettledAsyncResultErrorFx(result));
	return {
		startFn: () => {
			if (disabled || result.waiting || ownerItemId === undefined) return;
			enqueueFn({
				ownerItemId,
			});
		},
		pending: result.waiting,
	};
};
