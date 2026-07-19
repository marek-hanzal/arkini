import type { ErrorComponentProps } from "@tanstack/react-router";

import { GameEngineErrorView } from "~/ui/game/GameEngineErrorView";

/** Adapts TanStack Router error recovery to the reusable Game bootstrap error view. */
export const GameEngineErrorPage = ({ error, reset }: ErrorComponentProps) => (
	<GameEngineErrorView
		error={error}
		retry={reset}
	/>
);
