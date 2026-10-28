import { atom, read, update } from "claude-code";
import type { EngineInterface, Register } from "claude-code";

const selection = atom(
  { plugin: "quote-selection", key: "selection" } as const,
  null,
);
// The text last quoted or dismissed, so the band hides until a new selection.
const handled = atom(
  { plugin: "quote-selection", key: "handled" } as const,
  null,
);

const PREVIEW_LENGTH = 60;

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

export const register: Register = (on) => {
  on("session.start", async ($, e, next) => {
    await $.command.register({
      name: "quote",
      description: "Quote the selected transcript text into the prompt box",
    });

    // No event fires when the highlight changes, so poll for it.
    $.clock.every(250, () => {
      void (async () => {
        const text = (await $.ui.selection())?.text ?? null;
        if (text !== (await read($, selection))) {
          await update($, selection, () => text);
        }
      })();
    });

    return next(e);
  });

  on("command.run", { command: "quote" }, async ($) => ({
    text: (await quoteSelection($)) ?? "Quote added to the prompt box.",
  }));

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    const text = await read($, selection);
    const isHidden =
      e.props.hasSurvey || !text?.trim() || text === (await read($, handled));
    if (isHidden) {
      return next(e);
    }

    const { Box, Button, Text } = $.ui.resolve(e);
    const oneLine = text.trim().replace(/\s+/g, " ");
    const preview =
      oneLine.length > PREVIEW_LENGTH
        ? `${oneLine.slice(0, PREVIEW_LENGTH)}…`
        : oneLine;

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
        <Text dimColor> {preview} </Text>
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
  });
};
