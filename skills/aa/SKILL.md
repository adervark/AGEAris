---
name: aa
description: Pull up this project's AA board — the NOW block, the columns and WIP, or the open tasks on an older board — and its page in AGE Aris, starting AGE Aris if it is not running. Read-only. Use when the user types /aa or asks to see, show or pull up the board.
argument-hint: "[open | link]"
allowed-tools: Bash(bash *aa/aa.sh*)
---

# /aa — pull up the board

Run the script in this skill's folder from the project's directory, passing the
argument through, and show its output **exactly as printed**: no summary, no
commentary, no next steps unless the user asks.

```sh
bash <this skill's base directory>/aa.sh $ARGUMENTS
```

- No argument: print the board, then the AGE Aris link.
- `open`: the same, and open the link in the browser, signed in.
- `link`: track this repository in AGE Aris first. Do this only when the user
  asked for it. AGE Aris reads the repository; it changes the board's task
  files only through task actions the user switches on in AGE Aris.

The script changes nothing in the repository. If it prints an error, show it
and stop; do not try to fix the board.
