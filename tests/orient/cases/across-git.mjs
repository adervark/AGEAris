import { join } from 'node:path';

import { answer, AS_OF, at, card, data, HANDOFF, kase, ME, more, owner, rules, task } from '../corpus.mjs';

// What git says beyond HEAD: the upstream's tree, and with `remote`, whether
// the upstream branch moved since the last fetch. Each upstream is a bare
// repository beside the fixture, in the same temporary directory.

const TITLE = 'Write the parser';
const claimed = [
  { at: at('09:30', 1), ops: [task('T001', TITLE)] },
  { at: at('08:00'), subject: 'claim T001', ops: [task('T001', TITLE, { at: 'tasks', owner: owner(ME) })] },
];
const go = { do: 'continue', task: 'T001', reasons: ['in-progress'], rule: [3, 8] };

function upstream({ root, git }, pushed) {
  const origin = join(root, 'origin.git');
  git(['init', '--bare', '-q', '--initial-branch=main', origin]);
  git(['remote', 'add', 'origin', origin]);
  git(['push', '-q', 'origin', `${pushed}:refs/heads/main`]);
  git(['branch', '-q', '--set-upstream-to=origin/main', 'main']);
}

export default [
  kase({
    name: 'claim-unpushed',
    rows: [3],
    story: "The caller's claim is committed here but not pushed: the upstream still has the task in the backlog. Nobody else can see the claim yet. The upstream has not moved since the fetch.",
    commits: claimed,
    setup: (repo) => upstream(repo, 'HEAD~1'),
    call: { run: ME, remote: true },
    answer: answer({
      remote: { moved: 'no', checkedAt: AS_OF },
      next: go,
      rules: rules({ used: 1 }),
      you: [{ task: 'T001', column: 'in_progress' }],
      warnings: [{ code: 'claim-unpushed', task: 'T001' }],
      data: data({ T001: card('T001', TITLE, { handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),

  kase({
    name: 'remote-moved',
    rows: [3],
    story: 'Someone pushed to the upstream after the last fetch: ls-remote gives it another commit than the remote-tracking branch names. A claim made now may conflict.',
    commits: claimed,
    setup: (repo) => {
      const { git } = repo;
      upstream(repo, 'HEAD');
      const head = git(['rev-parse', 'HEAD']);
      const env = { GIT_AUTHOR_DATE: '2026-10-10T11:30:00Z', GIT_COMMITTER_DATE: '2026-10-10T11:30:00Z' };
      const pushed = git(['commit-tree', `${head}^{tree}`, '-p', head, '-m', 'claim T002'], { env });
      git(['push', '-q', 'origin', `${pushed}:refs/heads/main`]);
      git(['update-ref', 'refs/remotes/origin/main', head]);
    },
    call: { run: ME, remote: true },
    answer: answer({
      remote: { moved: 'yes', checkedAt: AS_OF },
      next: go,
      rules: rules({ used: 1 }),
      you: [{ task: 'T001', column: 'in_progress' }],
      data: data({ T001: card('T001', TITLE, { handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),
];
