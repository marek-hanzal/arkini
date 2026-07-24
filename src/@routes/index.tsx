import { createFileRoute, redirect } from "@tanstack/react-router";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { StartupPage } from "~/page/launcher/StartupPage";
import { LauncherSplashCompletedAtom } from "~/ui/launcher/LauncherSplashCompletedAtom";

const readLauncherSplashCompletedFx = Effect.fn("readLauncherSplashCompletedFx")(() =>
	Atom.get(LauncherSplashCompletedAtom),
);

export const Route = createFileRoute("/")({
	beforeLoad: ({ context }) => {
		if (context.rendererRuntime.runSync(readLauncherSplashCompletedFx())) {
			throw redirect({
				to: "/main-menu",
			});
		}
	},
	component: StartupPage,
});
