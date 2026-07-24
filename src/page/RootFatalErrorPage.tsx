import type { ErrorComponentProps } from "@tanstack/react-router";

import { RootFatalErrorView } from "~/ui/root/RootFatalErrorView";

/** Replaces the renderer after an unrecoverable route or Game Engine ownership failure. */
export const RootFatalErrorPage = ({ error }: ErrorComponentProps) => (
	<RootFatalErrorView error={error} />
);
