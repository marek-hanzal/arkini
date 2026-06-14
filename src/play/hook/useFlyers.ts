import { useCallback, useEffect, useRef, useState } from "react";
import type { FlyerKind, FlyerModel, VisualMeta, RectLike } from "~/play/types";
import { waitForPaint } from "~/shared/util/waitForPaint";

export function useFlyers() {
	const [flyers, setFlyers] = useState<FlyerModel[]>([]);
	const resolversRef = useRef(new Map<string, () => void>());
	const removingRef = useRef(new Set<string>());
	const mountedRef = useRef(true);

	const addFlyer = useCallback(
		(
			itemId: string,
			from: RectLike,
			to: RectLike,
			kind: FlyerKind = "move",
			meta?: VisualMeta,
		) =>
			new Promise<void>((resolve) => {
				const id = crypto.randomUUID();
				resolversRef.current.set(id, resolve);
				setFlyers((current) => [
					...current,
					{
						id,
						itemId,
						from,
						to,
						kind,
						...meta,
					},
				]);
			}),
		[],
	);

	const settleFlyer = useCallback((id: string) => {
		const resolve = resolversRef.current.get(id);
		if (!resolve || removingRef.current.has(id)) return;

		removingRef.current.add(id);
		resolversRef.current.delete(id);
		resolve();

		void waitForPaint().then(() => {
			if (!mountedRef.current) return;

			removingRef.current.delete(id);
			setFlyers((current) => current.filter((flyer) => flyer.id !== id));
		});
	}, []);

	useEffect(
		() => () => {
			mountedRef.current = false;
			for (const resolve of resolversRef.current.values()) resolve();
			resolversRef.current.clear();
			removingRef.current.clear();
		},
		[],
	);

	return {
		flyers,
		addFlyer,
		settleFlyer,
	};
}
