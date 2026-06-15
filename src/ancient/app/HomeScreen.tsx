import type { FC } from "react";
import { PlayShell } from "~/play/ui/PlayShell";

export namespace HomeScreen {
	export interface Props {}
}

export const HomeScreen: FC<HomeScreen.Props> = () => {
	return <PlayShell />;
};
