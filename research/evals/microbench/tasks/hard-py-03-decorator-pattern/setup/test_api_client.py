import pytest
from api_client import ApiClient, ApiError


class TestRetryDecorator:
    def test_get_succeeds_immediately(self):
        client = ApiClient("https://api.example.com")
        result = client.get("users/1")
        assert result["status"] == 200

    def test_post_succeeds_immediately(self):
        client = ApiClient("https://api.example.com")
        result = client.post("users", {"name": "Alice"})
        assert result["status"] == 201

    def test_delete_succeeds_immediately(self):
        client = ApiClient("https://api.example.com")
        result = client.delete("users/1")
        assert result["status"] == 204

    def test_get_retries_on_failure(self):
        client = ApiClient("https://api.example.com")
        client._set_fail_count(2)  # Fail first 2 attempts, succeed on 3rd
        result = client.get("users/1")
        assert result["status"] == 200
        assert client.request_count == 3

    def test_post_retries_on_failure(self):
        client = ApiClient("https://api.example.com")
        client._set_fail_count(1)  # Fail first attempt, succeed on 2nd
        result = client.post("users", {"name": "Bob"})
        assert result["status"] == 201
        assert client.request_count == 2

    def test_delete_retries_on_failure(self):
        client = ApiClient("https://api.example.com")
        client._set_fail_count(2)  # Fail first 2, succeed on 3rd
        result = client.delete("users/1")
        assert result["status"] == 204
        assert client.request_count == 3

    def test_raises_after_max_attempts(self):
        client = ApiClient("https://api.example.com")
        client._set_fail_count(10)  # Always fail
        with pytest.raises(ApiError):
            client.get("users/1")
        assert client.request_count == 3  # Should have tried 3 times

    def test_post_raises_after_max_attempts(self):
        client = ApiClient("https://api.example.com")
        client._set_fail_count(10)
        with pytest.raises(ApiError):
            client.post("users", {"name": "Fail"})
        assert client.request_count == 3
