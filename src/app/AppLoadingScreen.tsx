import type { FC } from "react";

export namespace AppLoadingScreen {
	export interface Props {}
}

export const AppLoadingScreen: FC<AppLoadingScreen.Props> = () => (
	<div className="grid h-dvh w-dvw place-items-center bg-ak-page text-sm font-semibold uppercase tracking-[0.16em] text-ak-text-muted">
		Booting Arkini…
	</div>
);
