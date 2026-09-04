export interface EditorFormValidationIssue {
	readonly message: string;
	readonly path: ReadonlyArray<PropertyKey>;
}
