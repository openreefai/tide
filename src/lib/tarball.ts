import { Parser } from 'tar';
import { Readable } from 'stream';

interface TarballContents {
  reefJson: Record<string, unknown>;
  readme: string | null;
}

export async function extractTarballContents(buffer: Buffer): Promise<TarballContents> {
  let reefJson: Record<string, unknown> | null = null;
  let readme: string | null = null;

  const entries: { path: string; content: string }[] = [];

  await new Promise<void>((resolve, reject) => {
    const parser = new Parser({
      onReadEntry(entry) {
        const chunks: Buffer[] = [];
        entry.on('data', (chunk: Buffer) => chunks.push(chunk));
        entry.on('end', () => {
          const content = Buffer.concat(chunks).toString('utf-8');
          entries.push({ path: entry.path, content });
        });
      },
    });
    parser.on('end', resolve);
    parser.on('error', reject);
    Readable.from(buffer).pipe(parser);
  });

  for (const entry of entries) {
    const name = entry.path.replace(/^[^/]+\//, '');
    if (name === 'reef.json') {
      try {
        reefJson = JSON.parse(entry.content);
      } catch {
        throw new Error('Invalid reef.json in tarball');
      }
    }
    if (/^readme\.md$/i.test(name)) {
      readme = entry.content;
    }
  }

  if (!reefJson) throw new Error('Tarball does not contain reef.json at root');

  return { reefJson, readme };
}
