import type { FC } from "react";
import { PlayShell } from "~/v0/play";

export namespace HomeScreen {
	export interface Props {}
}

export const HomeScreen: FC<HomeScreen.Props> = () => <PlayShell />;
