import type { ErrorComponentProps } from "@tanstack/react-router";

import { GameEngineErrorView } from "~/ui/game/GameEngineErrorView";

export interface GameEngineErrorPageProps extends ErrorComponentProps {
	readonly packageId: string;
}

/** Adapts one failed load route to the reusable explicit Game bootstrap recovery view. */
export const GameEngineErrorPage = ({ error, packageId }: GameEngineErrorPageProps) => (
	<GameEngineErrorView
		error={error}
		packageId={packageId}
	/>
);
