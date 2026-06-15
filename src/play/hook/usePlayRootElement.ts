import type { RefObject } from "react";
import { playRootElementId } from "~/play/playRootElementId";

const playRootElementRef = {
	get current() {
		return document.getElementById(playRootElementId) as HTMLElement | null;
	},
} as RefObject<HTMLElement | null>;

export const usePlayRootElement = () => playRootElementRef;
