import { useAtom } from "@effect/atom-react";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useEffect, useMemo, useState } from "react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { enqueueDefaultLineFx } from "~/production-job/fx/enqueueDefaultLineFx";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";

export namespace useItemSimpleDefaultController {
	export interface Props {
		readonly ownerItemId?: IdSchema.Type;
		readonly lineUid?: IdSchema.Type;
		readonly disabled: boolean;
		readonly ready: boolean;
		readonly autofillCovered: boolean;
	}
	export interface Output {
		readonly startFn: () => void;
		readonly pending: boolean;
		readonly displayReady: boolean;
	}
}

/** Submits the current effective Default line; engine admission resolves it again on click. */
export const useItemSimpleDefaultController = ({
	ownerItemId,
	lineUid,
	disabled,
	ready,
	autofillCovered,
}: useItemSimpleDefaultController.Props): useItemSimpleDefaultController.Output => {
	const game = useGameEngine();
	const [settled, setSettledFn] = useState({
		ownerItemId,
		lineUid,
		ready,
	});
	useEffect(() => {
		if (
			autofillCovered &&
			settled.ownerItemId === ownerItemId &&
			settled.lineUid === lineUid &&
			settled.ready
		)
			return;
		const timeout = setTimeout(
			() =>
				setSettledFn({
					ownerItemId,
					lineUid,
					ready,
				}),
			500,
		);
		return () => clearTimeout(timeout);
	}, [
		ownerItemId,
		lineUid,
		ready,
		autofillCovered,
		settled.ownerItemId,
		settled.lineUid,
		settled.ready,
	]);
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
	const displayReady =
		settled.ownerItemId === ownerItemId &&
		settled.lineUid === lineUid &&
		settled.ready &&
		(ready || autofillCovered);
	return {
		startFn: () => {
			if (disabled || !ready || !displayReady || result.waiting || ownerItemId === undefined)
				return;
			enqueueFn({
				ownerItemId,
			});
		},
		pending: result.waiting,
		displayReady,
	};
};
