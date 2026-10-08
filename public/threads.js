// Threads: a project's tasks organised by what they build on. A task's
// `depends:` names the tasks it builds on; the first one that exists on the
// board is its place in a thread, and any others are noted beside it. A thread
// is a task nothing else is filed under, plus everything filed under it; a task
// with no dependencies and nothing depending on it stands on its own.
// Pure functions over the workspace's task list, so they run in tests.

const OPEN = new Set(['backlog', 'in_progress', 'blocked']);
export const isOpen = (task) => OPEN.has(task.status);
const localOf = (task) => task.id.split(':').at(-1);
const byNumber = (a, b) => localOf(a).localeCompare(localOf(b), undefined, { numeric: true });

// For one project's tasks: the threads, the tasks on their own, and per task
// its place: { thread, parent, needs (every dependency on the board), alsoNeeds
// (dependencies other than its parent), children, waitingOn (open dependencies) }.
export function buildThreads(tasks) {
  const byLocal = new Map(tasks.map((task) => [localOf(task), task]));
  const place = new Map(tasks.map((task) => {
    const needs = (task.depends || []).map((id) => byLocal.get(id)).filter(Boolean);
    return [task.id, { task, needs, parent: needs[0] || null, alsoNeeds: needs.slice(1), children: [], waitingOn: needs.filter(isOpen), thread: null }];
  }));
  // A loop in the dependencies (T1 needs T2, T2 needs T1) is cut once, at its
  // lowest-numbered task, which then starts the thread.
  const settled = new Set();
  for (const task of tasks) {
    const path = [];
    let current = task;
    while (current && !settled.has(current.id)) {
      const at = path.indexOf(current);
      if (at >= 0) {
        const head = path.slice(at).sort(byNumber)[0];
        place.get(head.id).parent = null;
        break;
      }
      path.push(current);
      current = place.get(current.id).parent;
    }
    for (const entry of path) settled.add(entry.id);
  }
  const rootOf = (task) => {
    let current = task;
    while (place.get(current.id).parent) current = place.get(current.id).parent;
    return current;
  };
  for (const entry of place.values()) if (entry.parent) place.get(entry.parent.id).children.push(entry.task);
  for (const entry of place.values()) entry.children.sort(byNumber);
  const groups = new Map();
  for (const task of tasks) {
    const root = rootOf(task);
    if (!groups.has(root.id)) groups.set(root.id, []);
    groups.get(root.id).push(task);
  }
  const threads = [];
  const alone = [];
  for (const [rootId, members] of groups) {
    const root = place.get(rootId).task;
    if (members.length === 1) { alone.push(root); continue; }
    const thread = { root, tasks: members, open: members.filter(isOpen), rows: rowsOf(root, place) };
    for (const task of members) place.get(task.id).thread = thread;
    threads.push(thread);
  }
  // Threads with open work first, the most open first; then by number.
  threads.sort((a, b) => Number(b.open.length > 0) - Number(a.open.length > 0) || b.open.length - a.open.length || byNumber(a.root, b.root));
  return { threads, alone: alone.sort(byNumber), place };
}

// A thread as rows, depth first. A task with a single follower keeps it at its
// own depth ("then"), so a long chain stays one column; a task with several
// followers indents them. Each task appears once.
function rowsOf(root, place) {
  const rows = [];
  const seen = new Set();
  const walk = (task, depth, link) => {
    if (seen.has(task.id)) return;
    seen.add(task.id);
    rows.push({ task, depth, link });
    const { children } = place.get(task.id);
    if (children.length === 1) walk(children[0], depth, 'then');
    else for (const child of children) walk(child, depth + 1, 'branch');
  };
  walk(root, 0, 'root');
  return rows;
}

// What a thread shows before it is expanded: open tasks, the tasks they build
// on, and the thread's first task. Runs of other (finished) rows fold into one
// "n done" row, `{ fold: n }`.
export function visibleRows(thread, place, { expanded = false } = {}) {
  if (expanded) return thread.rows;
  const keep = new Set([thread.root.id]);
  for (const task of thread.open) {
    keep.add(task.id);
    for (const need of place.get(task.id).needs) keep.add(need.id);
  }
  const rows = [];
  let folded = 0;
  for (const row of thread.rows) {
    if (keep.has(row.task.id)) {
      if (folded) rows.push({ fold: folded, depth: row.depth });
      folded = 0;
      rows.push(row);
    } else folded += 1;
  }
  if (folded) rows.push({ fold: folded, depth: rows.at(-1)?.depth ?? 0 });
  return rows;
}
