import time


class ApiError(Exception):
    """Custom API error."""
    def __init__(self, status_code, message):
        self.status_code = status_code
        self.message = message
        super().__init__(f"API Error {status_code}: {message}")


class ApiClient:
    """Simple API client for a REST service."""

    def __init__(self, base_url):
        self.base_url = base_url
        self.request_count = 0

    def get(self, endpoint):
        """Perform a GET request."""
        self.request_count += 1
        url = f"{self.base_url}/{endpoint}"
        # Simulate request
        if hasattr(self, "_fail_count") and self.request_count <= self._fail_count:
            raise ApiError(503, "Service Unavailable")
        return {"status": 200, "url": url, "data": {"id": 1, "name": "test"}}

    def post(self, endpoint, data):
        """Perform a POST request."""
        self.request_count += 1
        url = f"{self.base_url}/{endpoint}"
        # Simulate request
        if hasattr(self, "_fail_count") and self.request_count <= self._fail_count:
            raise ApiError(503, "Service Unavailable")
        return {"status": 201, "url": url, "data": data}

    def delete(self, endpoint):
        """Perform a DELETE request."""
        self.request_count += 1
        url = f"{self.base_url}/{endpoint}"
        # Simulate request
        if hasattr(self, "_fail_count") and self.request_count <= self._fail_count:
            raise ApiError(503, "Service Unavailable")
        return {"status": 204, "url": url}

    def _set_fail_count(self, count):
        """Test helper: make the next `count` requests fail."""
        self._fail_count = count
        self.request_count = 0
