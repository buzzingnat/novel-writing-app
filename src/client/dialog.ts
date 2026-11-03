export type UnsavedChoice = "save" | "discard" | "cancel";

/**
 * Asks where to create a wiki page for a red link. Resolves null on cancel.
 * folder "" means directly in wiki/.
 */
export function askNewPage(
  target: string,
  folders: string[],
  defaultFolder: string,
): Promise<{ name: string; folder: string } | null> {
  const dialog = document.createElement("dialog");
  dialog.className = "app-dialog";
  const form = document.createElement("form");
  form.method = "dialog";

  const heading = document.createElement("p");
  heading.textContent = "Create a new wiki page";

  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Name";
  const name = document.createElement("input");
  name.value = target;
  name.required = true;
  nameLabel.append(name);

  const folderLabel = document.createElement("label");
  folderLabel.textContent = "Folder";
  const folder = document.createElement("select");
  for (const option of folders) folder.append(new Option(option.replace(/-/g, " "), option));
  folder.append(new Option("(wiki root)", ""));
  folder.value = folders.includes(defaultFolder) ? defaultFolder : (folders[0] ?? "");
  folderLabel.append(folder);

  const note = document.createElement("p");
  note.className = "dialog-note";
  note.textContent = "Uses the folder's template. Keep the name as is so the link finds the new page.";

  const buttons = document.createElement("div");
  buttons.className = "dialog-buttons";
  const cancel = document.createElement("button");
  // Not a submit button, so pressing Enter in the name field means Create.
  cancel.type = "button";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", () => dialog.close("cancel"));
  const create = document.createElement("button");
  create.value = "create";
  create.textContent = "Create";
  create.className = "primary";
  buttons.append(cancel, create);

  form.append(heading, nameLabel, folderLabel, note, buttons);
  dialog.append(form);
  document.body.append(dialog);

  return new Promise((resolve) => {
    dialog.addEventListener("close", () => {
      const created = dialog.returnValue === "create" && name.value.trim() !== "";
      dialog.remove();
      resolve(created ? { name: name.value.trim(), folder: folder.value } : null);
    });
    dialog.showModal();
    name.select();
  });
}

const SHORTCUTS: [string, string][] = [
  ["⌘S", "Save the open file (unsaved files also save every 5 minutes)"],
  ["⌘\\", "Manuscript: show or hide the chapter list"],
  ["Enter", "Wiki search: open the top result"],
  ["Esc", "Wiki search: clear the search; dialogs: cancel"],
];

/** Lists the keyboard shortcuts and a few how-tos. */
export function showHelp(): void {
  const dialog = document.createElement("dialog");
  dialog.className = "app-dialog help-dialog";
  const form = document.createElement("form");
  form.method = "dialog";

  const heading = document.createElement("p");
  heading.className = "help-heading";
  heading.textContent = "Keyboard shortcuts";
  const table = document.createElement("dl");
  table.className = "shortcuts";
  for (const [keys, action] of SHORTCUTS) {
    const term = document.createElement("dt");
    term.append(Object.assign(document.createElement("kbd"), { textContent: keys }));
    const description = document.createElement("dd");
    description.textContent = action;
    table.append(term, description);
  }

  const tips = document.createElement("ul");
  tips.className = "help-tips";
  for (const tip of [
    "Source and Preview (above each file) hide or show either side of the editor.",
    "Red wiki links have no page yet; click one to create it from the folder's template.",
    "If a file changes on disk while it's open, saving stops and asks: reload or keep yours.",
    "Daily word counts are net: words now minus words at the start of the day.",
  ]) {
    tips.append(Object.assign(document.createElement("li"), { textContent: tip }));
  }

  const buttons = document.createElement("div");
  buttons.className = "dialog-buttons";
  const close = document.createElement("button");
  close.value = "close";
  close.textContent = "Close";
  close.className = "primary";
  buttons.append(close);

  form.append(heading, table, tips, buttons);
  dialog.append(form);
  document.body.append(dialog);
  dialog.addEventListener("close", () => dialog.remove());
  dialog.showModal();
  close.focus();
}

/** Asks for one line of text, such as a new chapter's title. Resolves null on cancel or empty input. */
export function askText(heading: string, label: string, confirmLabel: string): Promise<string | null> {
  const dialog = document.createElement("dialog");
  dialog.className = "app-dialog";
  const form = document.createElement("form");
  form.method = "dialog";

  const title = document.createElement("p");
  title.textContent = heading;
  const field = document.createElement("label");
  field.textContent = label;
  const input = document.createElement("input");
  input.required = true;
  input.maxLength = 200;
  field.append(input);

  const buttons = document.createElement("div");
  buttons.className = "dialog-buttons";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", () => dialog.close("cancel"));
  const confirm = document.createElement("button");
  confirm.value = "ok";
  confirm.textContent = confirmLabel;
  confirm.className = "primary";
  buttons.append(cancel, confirm);

  form.append(title, field, buttons);
  dialog.append(form);
  document.body.append(dialog);

  return new Promise((resolve) => {
    dialog.addEventListener("close", () => {
      const value = dialog.returnValue === "ok" ? input.value.trim() : "";
      dialog.remove();
      resolve(value || null);
    });
    dialog.showModal();
    input.focus();
  });
}

/** Asks what to do with unsaved changes before leaving a file. Escape means cancel. */
export function askUnsaved(fileName: string): Promise<UnsavedChoice> {
  const dialog = document.createElement("dialog");
  dialog.className = "app-dialog";

  const form = document.createElement("form");
  form.method = "dialog";

  const message = document.createElement("p");
  message.textContent = `“${fileName}” has unsaved changes.`;

  const buttons = document.createElement("div");
  buttons.className = "dialog-buttons";
  const choices: [UnsavedChoice, string][] = [
    ["cancel", "Cancel"],
    ["discard", "Don't save"],
    ["save", "Save"],
  ];
  for (const [value, label] of choices) {
    const button = document.createElement("button");
    button.value = value;
    button.textContent = label;
    if (value === "save") button.className = "primary";
    buttons.append(button);
  }

  form.append(message, buttons);
  dialog.append(form);
  document.body.append(dialog);

  return new Promise((resolve) => {
    dialog.addEventListener("close", () => {
      const value = dialog.returnValue;
      dialog.remove();
      resolve(value === "save" || value === "discard" ? value : "cancel");
    });
    dialog.showModal();
    buttons.querySelector<HTMLButtonElement>("button.primary")?.focus();
  });
}
