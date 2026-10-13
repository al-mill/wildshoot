// Turns raw `cdk diff` output into the PR comment: one line per stack, with the
// diff of each changed stack folded into a <details> block.
// Preview locally: `npx dotenv -- cdk diff --context stage=staging 2>&1 | node scripts/cdk-diff-comment.mjs`
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const HEADER = '## Infrastructure diff';

// Bundling, asset publishing and change-set chatter that cdk prints around each stack.
const NOISE = [
  /^Bundling asset /,
  /^\s+\S+index\.js(\.map)?\s/,
  /^⚡ Done in /,
  /^(start|success): (Building|Built|Publishing|Published) /,
  /^Hold on while we create a read-only change set/,
  /^✨\s+Number of stacks with differences/,
];

// GitHub rejects comments over 65,536 characters.
const MAX_DIFF_LENGTH = 60000;

const FOOTER =
  '> Merging deploys staging. Production only changes when you run **Deploy → Production**.';

function splitStacks(lines) {
  const stacks = [];
  for (const line of lines) {
    const match = line.match(/^Stack (\S+)/);
    if (match) stacks.push({ name: match[1], lines: [] });
    else if (stacks.length > 0) stacks[stacks.length - 1].lines.push(line);
  }
  return stacks;
}

function tidy(lines) {
  return lines
    .filter(line => !NOISE.some(pattern => pattern.test(line)))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function summarise(diff) {
  const count = pattern => diff.split('\n').filter(l => pattern.test(l)).length;
  // Removed resources with a Retain policy are marked "orphan": left in the account, not deleted.
  const parts = [
    [count(/^\[\+\] AWS::/), 'to add'],
    [count(/^\[~\] AWS::/), 'to update'],
    [count(/^\[-\] AWS::(?!.* orphan$)/), 'to destroy'],
    [count(/^\[-\] AWS::.* orphan$/), 'to orphan (kept)'],
  ]
    .filter(([n]) => n > 0)
    .map(([n, label]) => `${n} ${label}`);

  const replaced = count(/^\[~\] AWS::.* (replace|may be replaced)$/);
  if (replaced > 0) parts.push(`⚠️ ${replaced} replaced`);
  if (diff.includes('IAM Statement Changes')) parts.push('🔐 IAM changes');
  return parts.length > 0 ? parts.join(' · ') : 'Changes outside resources';
}

function details(summary, text, limit) {
  const clipped =
    text.length > limit
      ? `${text.slice(0, limit)}\n… truncated, see the CDK diff job log`
      : text;
  return `<details>\n<summary>${summary}</summary>\n\n\`\`\`\n${clipped}\n\`\`\`\n</details>`;
}

export function formatDiff(output, exitCode) {
  const lines = output.split('\n');
  const stacks = splitStacks(lines);

  if (exitCode !== 0 || stacks.length === 0) {
    const tail = tidy(lines.slice(-150));
    return [
      HEADER,
      details(
        `❌ <strong>cdk diff failed</strong>${exitCode !== 0 ? ` (exit ${exitCode})` : ''}`,
        tail,
        MAX_DIFF_LENGTH
      ),
      FOOTER,
    ].join('\n\n');
  }

  const diffs = new Map(
    stacks
      .filter(
        stack =>
          !stack.lines.some(l => l.startsWith('There were no differences'))
      )
      .map(stack => [stack, tidy(stack.lines)])
  );

  // Smallest diffs first, so whatever a stack doesn't use passes to the bigger ones.
  const limits = new Map();
  let budget = MAX_DIFF_LENGTH;
  [...diffs]
    .sort(([, a], [, b]) => a.length - b.length)
    .forEach(([stack, diff], i, sorted) => {
      const limit = Math.floor(budget / (sorted.length - i));
      limits.set(stack, limit);
      budget -= Math.min(diff.length, limit);
    });

  const sections = stacks.map(stack => {
    const diff = diffs.get(stack);
    if (diff === undefined) return `**${stack.name}**: ✅ No changes`;
    return details(
      `<strong>${stack.name}</strong>: ${summarise(diff)}`,
      diff,
      limits.get(stack)
    );
  });

  return [HEADER, ...sections, FOOTER].join('\n\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  console.log(formatDiff(readFileSync(0, 'utf8'), 0));
}
