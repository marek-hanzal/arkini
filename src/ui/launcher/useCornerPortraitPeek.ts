import { useEffect, useRef, useState } from "react";
import { AboutPortraitAssets } from "~/ui/launcher/AboutPortraitAssets";

const randomBetween = (minimum: number, maximum: number) =>
	minimum + Math.random() * (maximum - minimum);

interface CornerPortraitPeekState {
	readonly activePortraitIndex: number | undefined;
	readonly sizePx: number;
}

const initialState: CornerPortraitPeekState = {
	activePortraitIndex: undefined,
	sizePx: 104,
};

/** Randomly selects which pre-rendered portrait peeks from one About-page corner. */
export const useCornerPortraitPeek = (active: boolean) => {
	const [peek, setPeek] = useState(initialState);
	const previousPortraitIndexRef = useRef<number | undefined>(undefined);

	useEffect(() => {
		if (!active) {
			setPeek((current) => ({
				...current,
				activePortraitIndex: undefined,
			}));
			return;
		}

		let disposed = false;
		let timeout: number | undefined;

		const schedulePeek = () => {
			timeout = window.setTimeout(
				() => {
					if (disposed) return;

					const candidates = AboutPortraitAssets.map((_, index) => index).filter(
						(index) => index !== previousPortraitIndexRef.current,
					);
					const nextIndex =
						candidates[Math.floor(Math.random() * candidates.length)] ?? 0;
					previousPortraitIndexRef.current = nextIndex;
					setPeek({
						activePortraitIndex: nextIndex,
						sizePx: Math.round(randomBetween(88, 124)),
					});

					timeout = window.setTimeout(
						() => {
							if (disposed) return;
							setPeek((current) => ({
								...current,
								activePortraitIndex: undefined,
							}));
							timeout = window.setTimeout(schedulePeek, randomBetween(700, 3_200));
						},
						randomBetween(1_100, 2_300),
					);
				},
				randomBetween(350, 2_800),
			);
		};

		schedulePeek();
		return () => {
			disposed = true;
			if (timeout !== undefined) window.clearTimeout(timeout);
		};
	}, [
		active,
	]);

	return peek;
};
