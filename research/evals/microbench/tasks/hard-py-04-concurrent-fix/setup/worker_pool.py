import threading
import time


class WorkerPool:
    """A simple worker pool that processes tasks concurrently."""

    def __init__(self, num_workers):
        self.num_workers = num_workers
        self.completed_count = 0
        self.results = []
        self.errors = []

    def _worker(self, task_fn, task_id):
        """Execute a single task."""
        try:
            result = task_fn(task_id)
            # Race condition: reading, incrementing, and writing without a lock
            current = self.completed_count
            time.sleep(0.001)  # Simulate work that widens the race window
            self.completed_count = current + 1
            self.results.append(result)
        except Exception as e:
            self.errors.append(str(e))

    def run(self, task_fn, num_tasks):
        """Run num_tasks tasks using the worker pool.

        Args:
            task_fn: Callable that takes a task_id and returns a result.
            num_tasks: Number of tasks to execute.

        Returns:
            dict with 'completed', 'results', and 'errors' keys.
        """
        self.completed_count = 0
        self.results = []
        self.errors = []

        threads = []
        for i in range(num_tasks):
            t = threading.Thread(target=self._worker, args=(task_fn, i))
            threads.append(t)

        # Start all threads
        for t in threads:
            t.start()

        # Wait for all threads to complete
        for t in threads:
            t.join()

        return {
            "completed": self.completed_count,
            "results": self.results,
            "errors": self.errors,
        }

    def get_completed_count(self):
        """Return the number of completed tasks."""
        return self.completed_count
