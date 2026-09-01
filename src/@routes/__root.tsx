import { createRootRouteWithContext, Outlet, useRouter } from "@tanstack/react-router";
import { Effect } from "effect";
import { Canvas } from "~/ui/ui/Canvas";
import { RootFatalErrorView } from "~/application-shell/ui/RootFatalErrorView";
import { readRendererLifecycleFx } from "~/application-runtime/fx/readRendererLifecycleFx";
import type { RootContext } from "~/application-shell/context/RootContext";

const RootRouteFatalErrorView = ({ error }: { readonly error: unknown }) => {
	const router = useRouter();

	return (
		<RootFatalErrorView
			error={error}
			onCloseFn={() =>
				router.options.context.rendererRuntime.runSync(
					readRendererLifecycleFx().pipe(
						Effect.flatMap((lifecycle) => lifecycle.forceCloseFx),
						Effect.orDie,
					),
				)
			}
		/>
	);
};

export const Route = createRootRouteWithContext<RootContext>()({
	/** Mounting the root viewport must never imply a playable Game resource. */
	component: () => (
		<Canvas>
			<Outlet />
		</Canvas>
	),
	errorComponent: ({ error }) => <RootRouteFatalErrorView error={error} />,
});
