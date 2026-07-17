import { type PropsWithChildren, useCallback, useEffect, useMemo, useState } from "react";

import { GameMenuContext } from "~/ui/game-menu/GameMenuContext";

/** Owns Escape-driven menu visibility only for the mounted active game shell. */
export const GameMenuProvider = ({ children }: PropsWithChildren) => {
	const [isOpen, setIsOpen] = useState(false);
	const open = useCallback(() => setIsOpen(true), []);
	const close = useCallback(() => setIsOpen(false), []);
	const toggle = useCallback(() => setIsOpen((current) => !current), []);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || event.defaultPrevented) return;
			event.preventDefault();
			toggle();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [
		toggle,
	]);

	const control = useMemo(
		() => ({
			isOpen,
			open,
			close,
			toggle,
		}),
		[
			close,
			isOpen,
			open,
			toggle,
		],
	);

	return <GameMenuContext.Provider value={control}>{children}</GameMenuContext.Provider>;
};
