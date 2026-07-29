/** Accepts the shared Inventory toggle key without stealing modified or editable input. */
export const isInventoryShortcutKey = (event: KeyboardEvent) => {
	const target = event.target;

	return (
		!event.repeat &&
		event.key.toLowerCase() === "i" &&
		!event.altKey &&
		!event.ctrlKey &&
		!event.metaKey &&
		!(
			target instanceof HTMLElement &&
			(target.isContentEditable ||
				target.tagName === "INPUT" ||
				target.tagName === "SELECT" ||
				target.tagName === "TEXTAREA")
		)
	);
};
