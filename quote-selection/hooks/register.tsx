import { atom, read, update } from "claude-code";
import type {
  EngineInterface,
  Register,
  RenderChildren,
  RenderInput,
} from "claude-code";

const selection = atom(
  { plugin: "quote-selection", key: "selection" } as const,
  null,
);
// The transcript row that holds the selection, so its buttons draw on that row.
const selectionRow = atom(
  { plugin: "quote-selection", key: "selectionRow" } as const,
  null,
);
// The text last quoted or dismissed, so the buttons hide until a new selection.
const handled = atom(
  { plugin: "quote-selection", key: "handled" } as const,
  null,
);

const PREVIEW_LENGTH = 60;

const TRANSCRIPT_ROWS = ["AssistantMessage", "UserMessage", "ToolUse"] as const;

function toBlockquote(text: string): string {
  return text
    .trim()
    .split("\n")
    .map((line) => (line.trim() === "" ? ">" : `> ${line}`))
    .join("\n");
}

// Returns an error message, or undefined when the quote was added.
async function quoteSelection($: EngineInterface): Promise<string | undefined> {
  const selected = await $.ui.selection();
  if (!selected?.text.trim()) {
    return "Nothing is selected. Select text in the transcript first.";
  }

  const block = toBlockquote(selected.text);
  const draft = await $.prompt.read();
  const filled =
    draft.text.trim() === ""
      ? await $.prompt.fill({ text: `${block}\n\n`, mode: "replace" })
      : await $.prompt.fill({ text: `\n\n${block}\n\n`, mode: "append" });
  if (!filled.isFilled) {
    return "The prompt box is not available, so the quote was not added.";
  }

  await update($, handled, () => selected.text);
  return undefined;
}

// The selected text, or undefined when there is none or it was already
// quoted or dismissed.
async function visibleSelection(
  $: EngineInterface,
): Promise<string | undefined> {
  const text = await read($, selection);
  if (!text?.trim() || text === (await read($, handled))) {
    return undefined;
  }
  return text;
}

// The Quote and dismiss buttons, with `middle` drawn between them.
function quoteButtons(
  $: EngineInterface,
  e: RenderInput,
  text: string,
  middle?: RenderChildren,
) {
  const { Box, Button } = $.ui.resolve(e);
  return (
    <Box>
      <Button
        key="quote"
        label="❝ Quote"
        onPress={async () => {
          const error = await quoteSelection($);
          if (error) {
            $.ui.toast(error);
          }
        }}
      />
      {middle}
      <Button
        key="dismiss"
        label="✕"
        role="dismiss"
        plain
        dimColor
        onPress={() => update($, handled, () => text)}
      />
    </Box>
  );
}

export const register: Register = (on) => {
  on("session.start", async ($, e, next) => {
    await $.command.register({
      name: "quote",
      description: "Quote the selected transcript text into the prompt box",
    });

    // No event fires when the highlight changes, so poll for it.
    $.clock.every(250, () => {
      void (async () => {
        const selected = await $.ui.selection();
        const text = selected?.text ?? null;
        const row = selected?.requestId ?? null;
        if (text !== (await read($, selection))) {
          await update($, selection, () => text);
        }
        if (row !== (await read($, selectionRow))) {
          await update($, selectionRow, () => row);
        }
      })();
    });

    return next(e);
  });

  // A key press takes the highlight off the screen, but `$.ui.selection()`
  // still returns the old text. Treat that text as dismissed so the buttons hide.
  on("prompt.edit", async ($, e, next) => {
    const result = await next(e);
    const text = await read($, selection);
    if (text !== null) {
      await update($, handled, () => text);
    }
    return result;
  });

  on("command.run", { command: "quote" }, async ($) => ({
    text: (await quoteSelection($)) ?? "Quote added to the prompt box.",
  }));

  // Draws the buttons over the top-right corner of the transcript row that
  // holds the selection. They sit on top of the row, so the text under the
  // highlight does not move.
  on("ui.render", { component: TRANSCRIPT_ROWS }, async ($, e, next) => {
    // Check the row first: a row redraws when state it read changes, so other
    // rows then redraw only when the selected row changes, not on each new text.
    if (e.requestId !== (await read($, selectionRow))) {
      return next(e);
    }
    const text = await visibleSelection($);
    if (!text) {
      return next(e);
    }

    const { Box } = $.ui.resolve(e);
    const row = await next(e);
    return (
      <Box key="quote-row" flexDirection="column">
        {row}
        <Box position="absolute" top={0} right={0}>
          {quoteButtons($, e, text)}
        </Box>
      </Box>
    );
  });

  // Draws the buttons above the prompt when no single drawn row holds the
  // selection, for example when it spans several messages.
  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    const text = await visibleSelection($);
    if (e.props.hasSurvey || !text || (await read($, selectionRow)) !== null) {
      return next(e);
    }

    const { Text } = $.ui.resolve(e);
    const oneLine = text.trim().replace(/\s+/g, " ");
    const preview =
      oneLine.length > PREVIEW_LENGTH
        ? `${oneLine.slice(0, PREVIEW_LENGTH)}…`
        : oneLine;

    return quoteButtons($, e, text, <Text dimColor> {preview} </Text>);
  });
};
