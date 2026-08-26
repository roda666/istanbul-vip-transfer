---
name: ShellExec background process lifecycle
description: Background (nohup/&) processes started inside one ShellExec call are killed when that call returns, even with output redirected to a file — plan long scripts as sequential foreground calls instead.
---

A `nohup node script.js > out.log 2>&1 &` launched inside a ShellExec invocation does not survive past that invocation returning — a later ShellExec call polling the log file finds the process gone and the log frozen at whatever it had written, even though the command reported a PID and initial output looked healthy.

**Why:** Each ShellExec call appears to run in its own process-group lifecycle; background children are reaped when the call's shell session ends, regardless of `nohup`/output redirection.

**How to apply:** For any script whose total runtime may exceed a single ShellExec timeout (5 min), don't background it — split the work into slices (e.g. by data partition/page/batch) and run each slice as its own **foreground**, synchronous ShellExec call, one after another. Design the script to accept a slice selector (env var or CLI arg) and to be safely re-runnable (idempotent upsert) so a slice can be retried without side effects.
