// Hosts the evaluation process: one run at a time, with a timeout that kills
// runaway user code and restarts it. The child runs under Node's permission
// model: it may only read its own files, and cannot write files, spawn
// processes or load native addons.
import { fork } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export class Evaluator {
  constructor({ timeoutMs = 3000, workerUrl = new URL('./eval-worker.mjs', import.meta.url) } = {}) {
    this.timeoutMs = timeoutMs;
    this.workerUrl = workerUrl;
    this.nextId = 1;
    this.pending = new Map();
    this.#spawn();
  }

  #spawn() {
    this.ready = new Promise((resolve, reject) => {
      const script = fileURLToPath(this.workerUrl);
      const worker = fork(script, [], {
        execArgv: ['--permission', `--allow-fs-read=${dirname(script)}`, '--max-old-space-size=512'],
        // Keep user-code output away from the LSP stdio channel.
        silent: true,
      });
      worker.stdout.resume();
      worker.stderr.resume();
      worker.on('message', (msg) => {
        if (msg.ready) return resolve();
        const p = this.pending.get(msg.id);
        if (!p) return;
        clearTimeout(p.timer);
        this.pending.delete(msg.id);
        p.resolve(msg.results);
      });
      worker.on('error', (err) => {
        reject(err);
        this.#failAll(err.message);
      });
      worker.on('exit', (code) => {
        reject(new Error(`evaluator exited with code ${code}`));
        if (this.worker === worker) {
          this.worker = null;
          this.#failAll('Strudel evaluator crashed');
        }
      });
      this.worker = worker;
    });
    this.ready.catch(() => {});
  }

  #failAll(message) {
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer);
      p.resolve([{ severity: 'error', message }]);
      this.pending.delete(id);
    }
  }

  async evaluate(code) {
    if (!this.worker) this.#spawn();
    try {
      await this.ready;
    } catch (e) {
      return [{ severity: 'warning', message: `Strudel evaluator failed to start: ${e.message}` }];
    }
    const id = this.nextId++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.worker?.kill();
        this.worker = null;
        resolve([{ severity: 'warning', message: `Evaluation timed out after ${this.timeoutMs}ms (infinite loop?)` }]);
      }, this.timeoutMs);
      this.pending.set(id, { resolve, timer });
      this.worker.send({ id, code });
    });
  }

  dispose() {
    this.worker?.kill();
  }
}
