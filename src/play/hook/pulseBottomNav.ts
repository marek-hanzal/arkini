import { playBottomNavPulse } from "~/animation/playBottomNavPulse";
import { queryElement } from "~/shared/util/queryElement";

export const pulseBottomNav = (sheet: "inventory") => {
	const element = queryElement(`[data-bottom-nav-sheet="${sheet}"]`);
	if (element) playBottomNavPulse(element);
};
