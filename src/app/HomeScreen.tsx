import type { FC } from "react";
import { PlayShell } from "~/play/PlayShell";

export namespace HomeScreen {
	export interface Props {}
}

export const HomeScreen: FC<HomeScreen.Props> = () => <PlayShell />;
