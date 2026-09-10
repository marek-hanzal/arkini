/** Resolves the optional persisted Editor draft status. */
export const readDraftFn = (item: { readonly draft?: boolean }): boolean => item.draft ?? false;
