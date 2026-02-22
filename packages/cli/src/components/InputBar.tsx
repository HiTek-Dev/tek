import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { useInputHistory } from "../hooks/useInputHistory.js";

interface InputBarProps {
	onSubmit: (text: string) => void;
	isActive: boolean;
	screenWidth?: number;
	onHeightChange?: (lines: number) => void;
}

/**
 * Bordered multiline input bar with cursor-aware editing and history support.
 *
 * - Full cursor navigation: left/right, Home (Ctrl+A), End (Ctrl+E)
 * - Insert/delete at cursor position
 * - Enter: submit message
 * - Shift+Enter: insert newline
 * - Up/Down arrows (when input empty): cycle message history
 * - Escape: clear input
 * - Expands up to 6 visible lines, then scrolls internally
 * - Bordered box with round style and cyan border
 * - Hint line below the border
 *
 * TODO: Use string-width for non-ASCII cursor positioning (CJK/emoji).
 */
export function InputBar({ onSubmit, isActive, screenWidth: _screenWidth, onHeightChange }: InputBarProps) {
	const [text, setText] = useState("");
	const [cursorPos, setCursorPos] = useState(0);
	const history = useInputHistory();

	const lines = text.split("\n");
	const totalLines = lines.length;
	const maxVisibleLines = 6;
	const visibleLines = totalLines <= maxVisibleLines
		? lines
		: lines.slice(totalLines - maxVisibleLines);
	const hiddenLineCount = totalLines > maxVisibleLines ? totalLines - maxVisibleLines : 0;

	// Report content line count to parent for layout calculation
	useEffect(() => {
		const reportedLines = Math.min(totalLines, maxVisibleLines);
		onHeightChange?.(reportedLines);
	}, [totalLines, onHeightChange]);

	useInput(
		(input, key) => {
			// Enter without Shift: submit
			if (key.return && !key.shift) {
				const trimmed = text.trim();
				if (trimmed) {
					history.push(text);
					onSubmit(trimmed);
					setText("");
					setCursorPos(0);
				}
				return;
			}

			// Shift+Enter: insert newline at cursor
			if (key.return && key.shift) {
				setText((prev) => prev.slice(0, cursorPos) + "\n" + prev.slice(cursorPos));
				setCursorPos((p) => p + 1);
				return;
			}

			// Escape: clear input
			if (key.escape) {
				setText("");
				setCursorPos(0);
				return;
			}

			// Left arrow: move cursor left
			if (key.leftArrow) {
				setCursorPos((p) => Math.max(0, p - 1));
				return;
			}

			// Right arrow: move cursor right
			if (key.rightArrow) {
				setCursorPos((p) => Math.min(text.length, p + 1));
				return;
			}

			// Home (Ctrl+A): move cursor to start
			if (key.ctrl && input === "a") {
				setCursorPos(0);
				return;
			}

			// End (Ctrl+E): move cursor to end
			if (key.ctrl && input === "e") {
				setCursorPos(text.length);
				return;
			}

			// Up arrow when input is empty: cycle history backward
			if (key.upArrow && text === "") {
				const prev = history.back();
				if (prev !== undefined) {
					setText(prev);
					setCursorPos(prev.length);
				}
				return;
			}

			// Down arrow when input is empty: cycle history forward
			if (key.downArrow && text === "") {
				const next = history.forward();
				if (next !== undefined) {
					setText(next);
					setCursorPos(next.length);
				} else {
					setText("");
					setCursorPos(0);
				}
				return;
			}

			// Backspace: delete character before cursor
			// Check both key.backspace and raw bytes (\x7F, \x08) for terminal compatibility
			if (key.backspace || input === "\x7F" || input === "\x08") {
				if (cursorPos > 0) {
					setText((prev) => prev.slice(0, cursorPos - 1) + prev.slice(cursorPos));
					setCursorPos((p) => p - 1);
				}
				return;
			}

			// Delete: delete character at cursor
			if (key.delete) {
				if (cursorPos < text.length) {
					setText((prev) => prev.slice(0, cursorPos) + prev.slice(cursorPos + 1));
				}
				return;
			}

			// Regular character input (no ctrl/meta modifiers)
			if (input && !key.ctrl && !key.meta) {
				setText((prev) => prev.slice(0, cursorPos) + input + prev.slice(cursorPos));
				setCursorPos((p) => p + input.length);
			}
		},
		{ isActive },
	);

	// Render cursor within text: split into before/after cursor segments
	const renderLineWithCursor = (line: string, lineStartIndex: number, lineIndex: number, isLastVisibleLine: boolean) => {
		const lineEndIndex = lineStartIndex + line.length;
		const cursorInThisLine = cursorPos >= lineStartIndex && cursorPos <= lineEndIndex;

		const prefix = lineIndex === 0 ? (
			<Text bold color="cyan">{"> "}</Text>
		) : (
			<Text>{"  "}</Text>
		);

		if (!isActive) {
			return (
				<Box key={lineIndex}>
					{prefix}
					<Text dimColor>{lineIndex === 0 ? "waiting..." : ""}</Text>
				</Box>
			);
		}

		if (cursorInThisLine) {
			const localCursorPos = cursorPos - lineStartIndex;
			const before = line.slice(0, localCursorPos);
			const cursorChar = line[localCursorPos] ?? " ";
			const after = line.slice(localCursorPos + 1);

			return (
				<Box key={lineIndex}>
					{prefix}
					<Text>
						{before}
						<Text inverse>{cursorChar}</Text>
						{after}
					</Text>
				</Box>
			);
		}

		return (
			<Box key={lineIndex}>
				{prefix}
				<Text>{line}</Text>
				{/* Show cursor block at end of last visible line if cursor is past all content */}
				{isLastVisibleLine && cursorPos === text.length && (
					<Text inverse>{" "}</Text>
				)}
			</Box>
		);
	};

	// Calculate the character index at the start of each visible line
	const getLineStartIndices = (): number[] => {
		const indices: number[] = [];
		let charIndex = 0;
		for (let i = 0; i < lines.length; i++) {
			if (i >= hiddenLineCount) {
				indices.push(charIndex);
			}
			charIndex += lines[i].length + 1; // +1 for the \n separator
		}
		return indices;
	};

	const lineStartIndices = getLineStartIndices();

	return (
		<Box flexDirection="column">
			<Box
				borderStyle="round"
				borderColor={isActive ? "cyan" : "gray"}
				flexDirection="column"
			>
				{hiddenLineCount > 0 && (
					<Text dimColor>  ({hiddenLineCount} more line{hiddenLineCount > 1 ? "s" : ""} above)</Text>
				)}
				{isActive && text === "" ? (
					<Box>
						<Text bold color="cyan">{"> "}</Text>
						<Text dimColor>Ask anything... (! for bash, / for commands)</Text>
					</Box>
				) : !isActive ? (
					<Box>
						<Text bold color="gray">{"> "}</Text>
						<Text dimColor>waiting...</Text>
					</Box>
				) : (
					visibleLines.map((line, i) =>
						renderLineWithCursor(
							line,
							lineStartIndices[i],
							i,
							i === visibleLines.length - 1,
						),
					)
				)}
			</Box>
			<Text dimColor>{"  Enter to send \u00B7 Shift+Enter for newline \u00B7 Esc to clear \u00B7 arrows to move"}</Text>
		</Box>
	);
}
