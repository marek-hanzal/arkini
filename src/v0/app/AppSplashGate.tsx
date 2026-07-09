import { type FC, type ReactNode, useEffect, useState } from "react";
import { AppSplashCrossfadeLayer } from "~/app/AppSplashCrossfadeLayer";
import type { AppSplashPhase } from "~/app/AppSplashPhase";
import { loadDefaultGameConfig } from "~/config/compiled/defaultGameConfig";
import { GAME_HERO_ASSET_ID } from "~/config/GameWellKnownAssetIds";
import { readGameConfigAssetSrc } from "~/config/readGameConfigAssetSrc";
import { AppSplashScreen } from "~/app/AppSplashScreen";

const APP_SPLASH_DURATION_MS = 3000;
const APP_SPLASH_FADE_DURATION_MS = 1500;

export namespace AppSplashGate {
	export interface Props {
		children: ReactNode;
		durationMs?: number;
		fadeDurationMs?: number;
	}
}

export const AppSplashGate: FC<AppSplashGate.Props> = ({
	children,
	durationMs = APP_SPLASH_DURATION_MS,
	fadeDurationMs = APP_SPLASH_FADE_DURATION_MS,
}) => {
	const [heroSrc, setHeroSrc] = useState<string | undefined>();
	const [phase, setPhase] = useState<AppSplashPhase>("visible");

	useEffect(() => {
		let disposed = false;

		void loadDefaultGameConfig()
			.then((config) => {
				if (disposed) return;
				setHeroSrc(
					readGameConfigAssetSrc({
						assetId: GAME_HERO_ASSET_ID,
						config,
					}),
				);
			})
			.catch((error: unknown) => {
				if (disposed) return;
				console.error(error);
			});

		return () => {
			disposed = true;
		};
	}, []);

	useEffect(() => {
		if (phase === "hidden") return undefined;

		const nextPhase: AppSplashPhase = phase === "visible" ? "fading" : "hidden";
		const timeoutMs = Math.max(0, phase === "visible" ? durationMs : fadeDurationMs);
		const timeout = globalThis.setTimeout(() => setPhase(nextPhase), timeoutMs);

		return () => globalThis.clearTimeout(timeout);
	}, [
		durationMs,
		fadeDurationMs,
		phase,
	]);

	return (
		<>
			<AppSplashCrossfadeLayer
				fadeDurationMs={fadeDurationMs}
				phase={phase}
			>
				{children}
			</AppSplashCrossfadeLayer>
			{phase === "hidden" ? null : (
				<AppSplashScreen
					fadeDurationMs={fadeDurationMs}
					heroSrc={heroSrc}
					phase={phase}
				/>
			)}
		</>
	);
};
