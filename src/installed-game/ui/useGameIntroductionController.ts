import { useEffect, useRef, useState } from "react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { PackageGameEngine } from "~/installed-game/type/Game";

export namespace useGameIntroductionController {
	export interface Props {
		readonly game: PackageGameEngine;
	}
	export interface Output {
		readonly content: string | undefined;
		readonly pending: boolean;
		readonly continueFn: () => void;
	}
}

/** UI admission for the exact installed game's one pending first-start welcome. */
export const useGameIntroductionController = ({
	game,
}: useGameIntroductionController.Props): useGameIntroductionController.Output => {
	const [pending, setPendingFn] = useState(false);
	const active = useRef(true);
	useEffect(() => {
		active.current = true;
		return () => {
			active.current = false;
		};
	}, [
		game,
	]);
	const continueFn = () => {
		if (pending || game.introduction === undefined) return;
		setPendingFn(true);
		void RendererRuntime.runPromise(game.introduction.continueFx).then(
			() => {
				if (active.current) setPendingFn(false);
			},
			(cause) => {
				if (!active.current) return;
				setPendingFn(false);
				game.reportCriticalFailureFn("game-runtime", cause);
			},
		);
	};
	return {
		content: game.introduction?.readFn(),
		pending,
		continueFn,
	};
};
