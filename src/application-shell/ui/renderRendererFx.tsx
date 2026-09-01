import { Cause, Effect } from "effect";
import type { ReactNode } from "react";
import type { Root } from "react-dom/client";

import { RootFatalErrorView } from "~/application-shell/ui/RootFatalErrorView";

interface RenderRendererFxProps<Requirements> {
	readonly onCloseFn: () => void;
	readonly root: Root;
	readonly viewFx: Effect.Effect<ReactNode, unknown, Requirements>;
}

/** Mounts either the fully bootstrapped renderer or its terminal startup failure. */
export const renderRendererFx = Effect.fn("renderRendererFx")(
	<Requirements,>({ onCloseFn, root, viewFx }: RenderRendererFxProps<Requirements>) =>
		viewFx.pipe(
			Effect.matchCauseEffect({
				onFailure: (cause) =>
					Effect.sync(() => {
						root.render(
							<RootFatalErrorView
								error={Cause.squash(cause)}
								onCloseFn={onCloseFn}
							/>,
						);
					}),
				onSuccess: (view) =>
					Effect.sync(() => {
						root.render(view);
					}),
			}),
		),
);
