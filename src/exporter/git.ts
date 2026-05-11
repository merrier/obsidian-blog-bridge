import { renderTemplateVariables } from "./path-utils";

export function renderCommitMessage(template: string, input: {
	title: string;
	slug: string;
	status: string;
}): string {
	return renderTemplateVariables(template, input);
}
