import { useContext } from "react";
import { PlayVisualMotionsContext } from "~/play/context/PlayVisualMotionsContext";

export namespace usePlayVisualMotionsState {
	export interface Props {}
}

export const usePlayVisualMotionsState = (_props?: usePlayVisualMotionsState.Props) => {
	const state = useContext(PlayVisualMotionsContext);
	if (!state)
		throw new Error("usePlayVisualMotionsState must be used inside PlaySessionProvider");
	return state;
};
