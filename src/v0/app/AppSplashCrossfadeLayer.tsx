import type { CSSProperties, FC, ReactNode } from "react";
import type { AppSplashPhase } from "~/app/AppSplashPhase";

export namespace AppSplashCrossfadeLayer {
	export interface Props {
		children: ReactNode;
		fadeDurationMs: number;
		phase: AppSplashPhase;
	}
}

const readCrossfadeStyle = (fadeDurationMs: number): CSSProperties => ({
	transitionDuration: `${fadeDurationMs}ms`,
	transitionProperty: "opacity",
	transitionTimingFunction: "ease-in-out",
	willChange: "opacity",
});

export const AppSplashCrossfadeLayer: FC<AppSplashCrossfadeLayer.Props> = ({
	children,
	fadeDurationMs,
	phase,
}) => {
	const hiddenBehindSplash = phase === "visible";

	return (
		<div
			aria-hidden={hiddenBehindSplash ? true : undefined}
			data-ui="app board crossfade layer"
			data-state={phase}
			className={hiddenBehindSplash ? "opacity-0" : "opacity-100"}
			style={readCrossfadeStyle(fadeDurationMs)}
		>
			{children}
		</div>
	);
};
