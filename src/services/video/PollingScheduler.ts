export interface PollingScheduler {
  scheduleRepeating(task: () => void, intervalMilliseconds: number): () => void;
}

export class BrowserPollingScheduler implements PollingScheduler {
  scheduleRepeating(task: () => void, intervalMilliseconds: number): () => void {
    const intervalId = window.setInterval(task, intervalMilliseconds);
    return () => window.clearInterval(intervalId);
  }
}
