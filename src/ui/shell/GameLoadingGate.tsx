import { type ReactNode, useCallback, useState } from "react";
import { settingsModalViewTransitionName } from "~/ui/settings/settingsModalViewTransitionName";
import { GameLoadingScreen } from "~/ui/shell/GameLoadingScreen";

export namespace GameLoadingGate {
	export interface Props {
		readonly children: ReactNode;
		readonly failure: ReactNode | null;
		readonly ready: boolean;
	}
}

/** Holds the first board reveal until loading progress reaches and briefly displays 100%. */
export const GameLoadingGate = ({ children, failure, ready }: GameLoadingGate.Props) => {
	const [initialLoadComplete, setInitialLoadComplete] = useState(false);
	const completeInitialLoad = useCallback(() => setInitialLoadComplete(true), []);

	if (failure !== null) return failure;
	if (initialLoadComplete) return children;

	return (
		<GameLoadingScreen
			ready={!initialLoadComplete && ready}
			onComplete={initialLoadComplete ? undefined : completeInitialLoad}
			viewTransitionName={settingsModalViewTransitionName}
		/>
	);
};
