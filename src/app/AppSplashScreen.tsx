import type { CSSProperties, FC } from "react";
import type { AppSplashPhase } from "~/app/AppSplashPhase";

export namespace AppSplashScreen {
	export interface Props {
		fadeDurationMs: number;
		heroSrc?: string;
		phase: AppSplashPhase;
	}
}

const readSplashClassName = (phase: AppSplashPhase) =>
	phase === "fading"
		? "fixed inset-0 grid place-items-center bg-ak-page px-6 opacity-0"
		: "fixed inset-0 grid place-items-center bg-ak-page px-6 opacity-100";

const readSplashStyle = (fadeDurationMs: number): CSSProperties => ({
	transitionDuration: `${fadeDurationMs}ms`,
	transitionProperty: "opacity",
	transitionTimingFunction: "ease-in-out",
	willChange: "opacity",
	zIndex: "var(--ak-layer-app-splash)",
});

export const AppSplashScreen: FC<AppSplashScreen.Props> = ({ fadeDurationMs, heroSrc, phase }) => (
	<div
		data-ui="app splash"
		className={readSplashClassName(phase)}
		data-state={phase}
		style={readSplashStyle(fadeDurationMs)}
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
