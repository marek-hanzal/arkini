import { QueryClientProvider } from "@tanstack/react-query";
import { Outlet } from "@tanstack/react-router";
import { Suspense, type FC } from "react";
import { AppLoadingScreen } from "~/app/AppLoadingScreen";
import { rootRoute } from "~/app/router";

export namespace RootShell {
	export interface Props {}
}

export const RootShell: FC<RootShell.Props> = () => {
	const { queryClient } = rootRoute.useRouteContext();

	return (
		<QueryClientProvider client={queryClient}>
			<Suspense fallback={<AppLoadingScreen />}>
				<Outlet />
			</Suspense>
		</QueryClientProvider>
	);
};
