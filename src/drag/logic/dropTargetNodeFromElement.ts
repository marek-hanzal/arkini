import { dropTargetSelector } from "~/drag/logic/dropTargetSelector";

export const dropTargetNodeFromElement = (element: Element) => {
	if (!(element instanceof HTMLElement)) return null;
	return element.closest<HTMLElement>(dropTargetSelector);
};
