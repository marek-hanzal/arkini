import { useContext } from "react";
import { PlayDragContext } from "~/play/context/PlayDragContext";

export namespace usePlayDragState {
	export interface Props {}
}

/**
 * GPT:FIX
 *
 * We don't really need crappy global drag state piece of shit potential causing re-renders of everything.
 */
export const usePlayDragState = (_props?: usePlayDragState.Props) => {
	const state = useContext(PlayDragContext);
	if (!state) throw new Error("usePlayDragState must be used inside PlaySessionProvider");
	return state;
};
