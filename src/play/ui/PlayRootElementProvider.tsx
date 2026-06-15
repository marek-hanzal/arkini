import type { FC, PropsWithChildren, RefObject } from "react";
import { PlayRootElementContext } from "~/play/context/PlayRootElementContext";

export namespace PlayRootElementProvider {
	export interface Props extends PropsWithChildren {
		rootRef: RefObject<HTMLElement | null>;
	}
}

/**
 * GPT:FIX
 *
 * We're freely using document selectors, so remove this crap and use stable html id for root container and
 * use it instead of this piece of shit
 *
 * Just ensure we would have fresh node instance when using query selector - also you may go against my idea
 * if you see it may give us more pain
 */
export const PlayRootElementProvider: FC<PlayRootElementProvider.Props> = ({
	children,
	rootRef,
}) => <PlayRootElementContext.Provider value={rootRef}>{children}</PlayRootElementContext.Provider>;
