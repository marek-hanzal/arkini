import type { FC } from "react";

export namespace AppSplashScreen {
	export interface Props {
		heroSrc?: string;
	}
}

export const AppSplashScreen: FC<AppSplashScreen.Props> = ({ heroSrc }) => (
	<div
		data-ui="app splash"
		className="fixed inset-0 grid place-items-center bg-ak-page px-6"
		style={{
			zIndex: "var(--ak-layer-app-splash)",
		}}
	>
		<div className="pointer-events-none relative grid w-full max-w-6xl place-items-center">
			<div className="absolute inset-x-[8%] top-1/2 h-20 -translate-y-1/2 rounded-full bg-ak-primary/20 blur-3xl" />
			{heroSrc ? (
				<img
					alt="Arkini"
					className="relative max-h-[72dvh] w-full object-contain drop-shadow-[0_0_40px_rgba(236,72,153,0.32)]"
					draggable={false}
					src={heroSrc}
				/>
			) : (
				<div className="relative rounded-sm border border-ak-border bg-ak-surface/75 px-5 py-4 text-sm font-black uppercase tracking-[0.22em] text-ak-text-muted">
					Arkini
				</div>
			)}
		</div>
	</div>
);
