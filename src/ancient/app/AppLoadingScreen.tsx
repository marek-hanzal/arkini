import type { FC } from "react";

export namespace AppLoadingScreen {
	export interface Props {}
}

export const AppLoadingScreen: FC<AppLoadingScreen.Props> = () => (
	<div className="grid h-dvh w-dvw place-items-center bg-slate-950 text-sm font-semibold tracking-[0.16em] text-slate-400 uppercase">
		Booting Arkini…
	</div>
);
