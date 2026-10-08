#!/usr/bin/env node
// Offline stand-in agent. Reads an AGE Aris stage prompt on stdin and answers
// with a short, deterministic response so the pipeline can be exercised
// without calling a model. Set REHEARSAL_VERDICT=FAIL to rehearse a failure.

let prompt = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) prompt += chunk;

const role = /^Role: (\w+)/m.exec(prompt)?.[1] || 'stage';
const task = /^Task: (.+)$/m.exec(prompt)?.[1] || 'the task';
const wantsVerdict = /VERDICT: PASS/.test(prompt);

const bodies = {
  triage: `Triage of ${task}:\n\n- Scope: small, local, reversible.\n- Risk: low.\n- Suggested path: plan, implement, review, verify.`,
  plan: `Plan for ${task}:\n\n1. Confirm the goal and what done looks like.\n2. Make the smallest change that satisfies it.\n3. Check the result against the goal.`,
  implement: `Implementation notes for ${task}:\n\n- Followed the approved plan step by step.\n- No external or irreversible actions were taken.`,
  review: `Review of ${task}:\n\n- The implementation follows the approved plan.\n- No defects found in the rehearsal.`,
  verify: `Verification of ${task}:\n\n- Each step of the plan has a matching result.\n- The goal is satisfied.`,
};

process.stdout.write(`${bodies[role] || `Rehearsal response for the ${role} stage of ${task}.`}\n`);
if (wantsVerdict) process.stdout.write(`\nVERDICT: ${process.env.REHEARSAL_VERDICT === 'FAIL' ? 'FAIL' : 'PASS'}\n`);
