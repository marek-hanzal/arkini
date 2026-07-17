import { useEffect, useState } from "react";

/** Tracks the renderer's reduced-motion preference for launcher transitions. */
export const usePrefersReducedMotion = () => {
	const [reduced, setReduced] = useState(() =>
		typeof window === "undefined"
			? false
			: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
	);

	useEffect(() => {
		const media = window.matchMedia("(prefers-reduced-motion: reduce)");
		const update = () => setReduced(media.matches);
		media.addEventListener("change", update);
		return () => media.removeEventListener("change", update);
	}, []);

	return reduced;
};
