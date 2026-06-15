import type { FC, PropsWithChildren, RefObject } from "react";
import { PlayRootElementContext } from "~/play/context/PlayRootElementContext";

export namespace PlayRootElementProvider {
	export interface Props extends PropsWithChildren {
		rootRef: RefObject<HTMLElement | null>;
	}
}

export const PlayRootElementProvider: FC<PlayRootElementProvider.Props> = ({
	children,
	rootRef,
}) => <PlayRootElementContext.Provider value={rootRef}>{children}</PlayRootElementContext.Provider>;
