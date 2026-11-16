import type { PromptEditInput } from "claude-code";
import { expect, mock, test } from "claude-code/testing";

const BAND = {
  plugin: "quote-selection",
  component: "AbovePrompt",
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 9 },
    view: {},
  },
} as const;

test("a key in the prompt box hides the band until a new selection", async ($, on) => {
  const clock = mock.clock(on);
  let selected: string | undefined = "first highlight";
  on("ui.selection", () => ({
    value: selected === undefined ? undefined : { text: selected },
  }));
  // Stands for the engine's own band, drawn when the plugin passes.
  on("ui.render", ($, e) => {
    const { Text } = $.ui.resolve(e);
    return <Text>engine</Text>;
  });
  on("command.register", () => ({ value: { command: "quote" } }));
  on("session.start", (_, e) => ({ cwd: e.cwd }));
  on("prompt.edit", (_, e) => ({
    text: e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end),
    cursor: e.start + e.inputText.length,
  }));

  await $.session.start({ cwd: "/", surface: "terminal", isInteractive: true });
  await clock.advance(250);

  for (const surface of ["terminal", "desktop"] as const) {
    const ui = await $.ui.mount({ ...BAND, surface });
    expect(await ui.find({ type: "Button", key: "quote" })).toBeDefined();
    await ui.unmount();
  }

  // The person types: the highlight is gone, but the engine still answers
  // the old text.
  // The test kit raises `prompt.edit` from `$.prompt.edit`, but its `Engine`
  // type does not list it.
  const prompt = $.prompt as unknown as {
    edit: (e: PromptEditInput) => Promise<unknown>;
  };
  await prompt.edit({
    origin: { kind: "composer" },
    text: "",
    cursor: 0,
    start: 0,
    end: 0,
    inputText: "h",
  });
  await clock.advance(250);

  for (const surface of ["terminal", "desktop"] as const) {
    const ui = await $.ui.mount({ ...BAND, surface });
    expect(await ui.find({ type: "Button", key: "quote" })).toBeUndefined();
    await ui.unmount();
  }

  selected = "second highlight";
  await clock.advance(250);

  for (const surface of ["terminal", "desktop"] as const) {
    const ui = await $.ui.mount({ ...BAND, surface });
    expect(await ui.find({ type: "Button", key: "quote" })).toBeDefined();
    await ui.unmount();
  }
});
