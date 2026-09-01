from app.core.redaction import REDACTED, redact_mapping, redact_text


def test_openai_style_key_redacted():
    text = "sk-abcDEFGHIJKLMNOPQRSTuVWXYZ0123456789 sent in config"
    assert "sk-abcDEFGHIJKLMNOPQRSTuVWXYZ0123456789" not in redact_text(text)
    assert REDACTED in redact_text(text)


def test_github_token_redacted():
    text = "token ghp_1234567890abcdefghijklmnopqrstuvwxyz here"
    assert "ghp_" not in redact_text(text)


def test_api_key_assignment_redacted():
    text = 'API_KEY="very-secret-value-1234567890"'
    assert REDACTED in redact_text(text)


def test_private_key_block_redacted():
    text = "-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----"
    assert REDACTED in redact_text(text)


def test_plain_text_untouched():
    text = "select * from users where id = 42"
    assert redact_text(text) == text


def test_redact_mapping_redacts_strings_only():
    mapping = {"mykey": "sk-ABcDEFGHIJKLMNOPQRSTUVWXYZ0123456789", "num": 12}
    out = redact_mapping(mapping)
    assert out["mykey"] == REDACTED
    assert out["num"] == 12