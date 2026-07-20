import { useEffect, useState } from "react";

const aboutEasterEggDelayMs = 2_000;

/** Delays the About-page easter egg until the settled page has been visible for a moment. */
export const useAboutEasterEggDelay = () => {
	const [active, setActive] = useState(false);

	useEffect(() => {
		const timeout = window.setTimeout(() => setActive(true), aboutEasterEggDelayMs);
		return () => window.clearTimeout(timeout);
	}, []);

	return active;
};
