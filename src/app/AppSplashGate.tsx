import { type FC, type ReactNode, useEffect, useState } from "react";
import { loadDefaultGameConfig } from "~/config/compiled/defaultGameConfig";
import { GAME_HERO_ASSET_ID } from "~/config/GameWellKnownAssetIds";
import { readGameConfigAssetSrc } from "~/config/readGameConfigAssetSrc";
import { AppSplashScreen } from "~/app/AppSplashScreen";

const APP_SPLASH_DURATION_MS = 3000;

export namespace AppSplashGate {
	export interface Props {
		children: ReactNode;
		durationMs?: number;
	}
}

export const AppSplashGate: FC<AppSplashGate.Props> = ({
	children,
	durationMs = APP_SPLASH_DURATION_MS,
}) => {
	const [heroSrc, setHeroSrc] = useState<string | undefined>();
	const [visible, setVisible] = useState(true);

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
		if (!visible) return undefined;
		const timeout = globalThis.setTimeout(() => setVisible(false), durationMs);
		return () => globalThis.clearTimeout(timeout);
	}, [
		durationMs,
		visible,
	]);

	return (
		<>
			{children}
			{visible ? <AppSplashScreen heroSrc={heroSrc} /> : null}
		</>
	);
};
