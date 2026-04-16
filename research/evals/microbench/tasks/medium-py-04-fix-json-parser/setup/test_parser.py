import pytest
from parser import parse_config, get_config_value


def test_flat_config():
    config = parse_config('{"name": "myapp", "version": "1.0"}')
    assert config["name"] == "myapp"
    assert config["version"] == "1.0"


def test_nested_config():
    config = parse_config(
        '{"db": {"host": "localhost", "port": "5432"}, "app": {"debug": "true"}}'
    )
    assert config["db.host"] == "localhost"
    assert config["db.port"] == "5432"
    assert config["app.debug"] == "true"


def test_deeply_nested_config():
    config = parse_config(
        '{"server": {"ssl": {"enabled": "true", "cert": "/path/cert.pem"}}}'
    )
    assert config["server.ssl.enabled"] == "true"
    assert config["server.ssl.cert"] == "/path/cert.pem"


def test_mixed_flat_and_nested():
    config = parse_config(
        '{"name": "myapp", "db": {"host": "localhost"}}'
    )
    assert config["name"] == "myapp"
    assert config["db.host"] == "localhost"


def test_get_config_value():
    config = parse_config('{"db": {"host": "localhost"}}')
    assert get_config_value(config, "db.host") == "localhost"
    assert get_config_value(config, "missing.key") is None
