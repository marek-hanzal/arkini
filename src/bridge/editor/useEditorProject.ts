import { getRouteApi } from "@tanstack/react-router";

const editorProjectRouteApi = getRouteApi("/editor/$projectId");

/** Reads the project snapshot compiled by the active editor project route. */
export const useEditorProject = () => editorProjectRouteApi.useLoaderData();
