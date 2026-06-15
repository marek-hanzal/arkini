import { useContext } from "react";
import { PlayScheduleContext } from "~/play/context/PlayScheduleContext";

export namespace usePlaySchedule {
	export interface Props {}
}

export const usePlaySchedule = (_props?: usePlaySchedule.Props) => {
	const schedule = useContext(PlayScheduleContext);
	if (!schedule) throw new Error("usePlaySchedule must be used inside PlaySessionProvider");
	return schedule;
};
