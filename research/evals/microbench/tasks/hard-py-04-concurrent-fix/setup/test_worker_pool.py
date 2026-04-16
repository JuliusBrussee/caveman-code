import pytest
from worker_pool import WorkerPool


def simple_task(task_id):
    """A simple task that returns the task ID doubled."""
    return task_id * 2


def failing_task(task_id):
    """A task that fails for odd IDs."""
    if task_id % 2 == 1:
        raise ValueError(f"Task {task_id} failed")
    return task_id * 2


class TestWorkerPool:
    def test_single_task(self):
        pool = WorkerPool(num_workers=1)
        result = pool.run(simple_task, 1)
        assert result["completed"] == 1
        assert len(result["results"]) == 1
        assert len(result["errors"]) == 0

    def test_multiple_tasks(self):
        pool = WorkerPool(num_workers=4)
        result = pool.run(simple_task, 10)
        assert result["completed"] == 10
        assert len(result["results"]) == 10
        assert len(result["errors"]) == 0

    def test_concurrent_counter_accuracy(self):
        """This test catches the race condition.
        With 50 concurrent tasks, the unsynchronized counter
        will almost certainly lose increments.
        """
        pool = WorkerPool(num_workers=8)
        result = pool.run(simple_task, 50)
        assert result["completed"] == 50, (
            f"Expected 50 completed, got {result['completed']}. "
            f"Race condition detected!"
        )

    def test_concurrent_counter_large(self):
        """Larger test to make race condition very likely."""
        pool = WorkerPool(num_workers=16)
        result = pool.run(simple_task, 100)
        assert result["completed"] == 100, (
            f"Expected 100 completed, got {result['completed']}. "
            f"Race condition detected!"
        )

    def test_results_collected(self):
        pool = WorkerPool(num_workers=4)
        result = pool.run(simple_task, 5)
        assert sorted(result["results"]) == [0, 2, 4, 6, 8]

    def test_error_handling(self):
        pool = WorkerPool(num_workers=4)
        result = pool.run(failing_task, 6)
        # Tasks 0, 2, 4 succeed; tasks 1, 3, 5 fail
        assert result["completed"] == 3
        assert len(result["results"]) == 3
        assert len(result["errors"]) == 3

    def test_get_completed_count(self):
        pool = WorkerPool(num_workers=4)
        pool.run(simple_task, 20)
        assert pool.get_completed_count() == 20
