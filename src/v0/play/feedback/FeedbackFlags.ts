export namespace FeedbackFlags {
	export interface Type {
		flags: ReadonlySet<string>;
		pulse(key: string): void;
		has(key: string): boolean;
	}
}
