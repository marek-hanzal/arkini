export function queryElement(selector: string) {
	return document.querySelector<HTMLElement>(selector) ?? undefined;
}
