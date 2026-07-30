export async function formatMarkdown(value: string): Promise<string> {
  try {
    const [{ format }, { default: markdownPlugin }] = await Promise.all([
      import('prettier/standalone'),
      import('prettier/plugins/markdown')
    ]);
    const formatted = await format(value, {
      parser: 'markdown',
      plugins: [markdownPlugin],
      proseWrap: 'preserve'
    });
    return formatted.trimEnd();
  } catch {
    return value;
  }
}
