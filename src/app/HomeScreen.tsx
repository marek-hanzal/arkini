import type { FC } from "react";
import { PlayShell } from "~/play";

export namespace HomeScreen {
	export interface Props {}
}

export const HomeScreen: FC<HomeScreen.Props> = () => <PlayShell />;
