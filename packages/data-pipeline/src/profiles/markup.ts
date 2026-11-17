// A shipped Profile's text is `**bold**` and plain prose; web renders the bold
// runs as elements and everything else as text, so markup it would not render
// has to be caught here.
const MARKDOWN_LINK = /\[[^\]]*\]\([^)]*\)/;

function excerpt(text: string): string {
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

export function assertBoldOnlyMarkup(text: string, where: string): void {
  if (text.split('**').length % 2 === 0) {
    throw new Error(`${where}: unpaired "**" in "${excerpt(text)}"`);
  }
  const withoutBold = text.replaceAll('**', '');
  if (
    withoutBold.includes('<') ||
    withoutBold.includes('`') ||
    withoutBold.includes('*') ||
    MARKDOWN_LINK.test(withoutBold)
  ) {
    throw new Error(
      `${where}: markup other than **bold** in "${excerpt(text)}"`,
    );
  }
}
