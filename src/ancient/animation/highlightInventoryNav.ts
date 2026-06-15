import { playBottomNavHold } from "./playBottomNavHold";
import { queryElement } from "~/shared/util/queryElement";

export const highlightInventoryNav = () => {
	const element = queryElement('[data-bottom-nav-sheet="inventory"]');
	if (element) playBottomNavHold(element);
};
