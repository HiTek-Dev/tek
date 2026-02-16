import React from "react";
import { Text } from "ink";
import { renderMarkdown } from "../lib/markdown.js";

interface MarkdownRendererProps {
	content: string;
}

/**
 * Ink component that renders markdown content with terminal formatting
 * and syntax-highlighted code blocks.
 */
export function MarkdownRenderer({ content }: MarkdownRendererProps) {
	return <Text>{renderMarkdown(content)}</Text>;
}
