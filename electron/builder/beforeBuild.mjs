// Runtime dependencies are copied as explicit file sets. Returning false keeps
// electron-builder from rebuilding or traversing the repository dependency graph.
export const beforeBuild = () => false;
