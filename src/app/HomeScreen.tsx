import type { FC } from "react";
import { AppSplashGate } from "~/app/AppSplashGate";
import { PlayShell } from "~/play/PlayShell";

export namespace HomeScreen {
	export interface Props {}
}

export const HomeScreen: FC<HomeScreen.Props> = () => (
	<AppSplashGate>
		<PlayShell />
	</AppSplashGate>
);
