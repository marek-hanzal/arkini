import { useContext } from "react";
import { PlayFeedbackContext } from "~/play/context/PlayFeedbackContext";

export namespace usePlayFeedbackState {
	export interface Props {}
}

export const usePlayFeedbackState = (_props?: usePlayFeedbackState.Props) => {
	const state = useContext(PlayFeedbackContext);
	if (!state) throw new Error("usePlayFeedbackState must be used inside PlaySessionProvider");
	return state;
};
