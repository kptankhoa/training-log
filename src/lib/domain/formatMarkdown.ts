function importPlugins() {
  return Promise.all([import('prettier/standalone'), import('prettier/plugins/markdown')]);
}

let pendingPlugins: ReturnType<typeof importPlugins> | null = null;

function loadPlugins() {
  if (!pendingPlugins) {
    pendingPlugins = importPlugins().catch((err) => {
      pendingPlugins = null;
      throw err;
    });
  }
  return pendingPlugins;
}

export function preloadMarkdownFormatter(): void {
  void loadPlugins();
}

export async function formatMarkdown(value: string): Promise<string> {
  try {
    const [{ format }, { default: markdownPlugin }] = await loadPlugins();
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
