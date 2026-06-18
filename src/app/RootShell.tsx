import { Outlet } from "@tanstack/react-router";
import { Suspense, type FC } from "react";
import { AppLoadingScreen } from "~/app/AppLoadingScreen";

export namespace RootShell {
	export interface Props {}
}

export const RootShell: FC<RootShell.Props> = () => (
	<Suspense fallback={<AppLoadingScreen />}>
		<Outlet />
	</Suspense>
);
