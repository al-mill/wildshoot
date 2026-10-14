// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { formatDiff, HEADER } from './cdk-diff-comment.mjs';

const output = (...lines: string[]) => lines.join('\n');

const UNCHANGED = ['Stack WildshootCi', 'There were no differences', ''];

const CHANGED = [
  'Stack Wildshoot-production',
  'Bundling asset Wildshoot-production/Api/Login/Code/Stage...',
  '  cdk.out/bundling-temp-abc/index.js      1.2kb',
  '⚡ Done in 12ms',
  'IAM Statement Changes',
  '┌───┬──────────┐',
  'Resources',
  '[+] AWS::Lambda::Function Api/Login ApiLogin123',
  '[+] AWS::IAM::Role Api/Login/ServiceRole ApiLoginServiceRole456',
  '[~] AWS::ApiGateway::Deployment Api/Deployment ApiDeployment789 replace',
  '[-] AWS::SNS::Topic Old OldTopic000 destroy',
  '',
];

describe('formatDiff', () => {
  it('starts with the header the workflow matches the existing comment on', () => {
    expect(formatDiff(output(...UNCHANGED), 0).startsWith(HEADER)).toBe(true);
  });

  it('gives an unchanged stack one line', () => {
    expect(formatDiff(output(...UNCHANGED), 0)).toContain(
      '**WildshootCi**: ✅ No changes'
    );
  });

  it('gives a stack the workflow skipped as not deployed one line', () => {
    const body = formatDiff(
      output(...UNCHANGED, 'Stack Wildshoot-production', 'Not deployed yet'),
      0
    );

    expect(body).toContain(
      '**Wildshoot-production**: ⏭️ Not deployed yet, so not diffed'
    );
    expect(body).not.toContain('<details>');
  });

  it('summarises a changed stack and folds its diff without the bundling noise', () => {
    const body = formatDiff(output(...UNCHANGED, ...CHANGED), 0);

    expect(body).toContain(
      '<summary><strong>Wildshoot-production</strong>: 2 to add · 1 to update · 1 to destroy · ⚠️ 1 replaced · 🔐 IAM changes</summary>'
    );
    expect(body).toContain('[+] AWS::Lambda::Function Api/Login ApiLogin123');
    expect(body).not.toContain('Bundling asset');
    expect(body).not.toContain('⚡ Done in');
  });

  it('shows the end of the output when cdk diff fails', () => {
    const body = formatDiff(
      output('Bundling asset X...', 'Error: Cannot find module ./foo'),
      1
    );

    expect(body).toContain('❌ <strong>cdk diff failed</strong> (exit 1)');
    expect(body).toContain('Error: Cannot find module ./foo');
  });

  it('keeps the comment under the GitHub size limit', () => {
    const huge = Array.from(
      { length: 5000 },
      (_, i) => `[+] AWS::IAM::Policy Policy${i} Policy${i}ABCDEF`
    );
    const body = formatDiff(output('Stack Big', ...huge), 0);

    expect(body.length).toBeLessThan(65536);
    expect(body).toContain('… truncated, see the CDK diff job log');
  });

  it('counts retained resources as orphaned, not destroyed', () => {
    const body = formatDiff(
      output(
        'Stack Wildshoot-production',
        '[-] AWS::RDS::DBInstance Database Database123 orphan',
        '[-] AWS::SNS::Topic Old OldTopic000 destroy'
      ),
      0
    );

    expect(body).toContain('1 to destroy · 1 to orphan (kept)');
  });

  it('gives a big diff the budget a small one leaves unused', () => {
    const big = Array.from(
      { length: 1000 },
      (_, i) => `[+] AWS::IAM::Policy Policy${i} Policy${i}ABCDEF`
    );
    const body = formatDiff(
      output(
        'Stack WildshootCi',
        '[~] AWS::IAM::Role DeployRole DeployRole885297C3',
        'Stack Wildshoot-staging',
        ...big
      ),
      0
    );

    expect(big.join('\n').length).toBeGreaterThan(30000);
    expect(body).not.toContain('truncated');
  });
});
