export namespace TranslationSource {
	export interface Jsx {
		readonly attr: string;
		readonly name: string;
	}

	export interface Function {
		readonly name: string;
	}

	export interface Object {
		readonly name: string;
		readonly object: string;
	}

	export interface Sources {
		readonly functions: readonly Function[];
		readonly jsx: readonly Jsx[];
		readonly objects: readonly Object[];
	}
}
