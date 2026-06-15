import { useContext } from "react";
import { PlaySheetsContext } from "~/play/context/PlaySheetsContext";

export namespace usePlaySheetsState {
	export interface Props {}
}

export const usePlaySheetsState = (_props?: usePlaySheetsState.Props) => {
	const state = useContext(PlaySheetsContext);
	if (!state) throw new Error("usePlaySheetsState must be used inside PlaySessionProvider");
	return state;
};
