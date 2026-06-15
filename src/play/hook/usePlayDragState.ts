import { useContext } from "react";
import { PlayDragContext } from "~/play/context/PlayDragContext";

export namespace usePlayDragState {
	export interface Props {}
}

export const usePlayDragState = (_props?: usePlayDragState.Props) => {
	const state = useContext(PlayDragContext);
	if (!state) throw new Error("usePlayDragState must be used inside PlaySessionProvider");
	return state;
};
