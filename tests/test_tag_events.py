"""Tests for what tag_events.py still does: refuse the frozen schedule, and carry a prompt to `claude -p`
on stdin. The transport's encoding test is in test_draft_people.py, beside the drafter that found the
bug. Nothing here calls a model.

Run:  python -m pytest tests/
"""
import json
import os
import subprocess
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)

import pytest  # noqa: E402

import tag_events  # noqa: E402


def no_model(*args, **kwargs):
    raise AssertionError("no model may be called")


# --- the frozen schedule -----------------------------------------------------

@pytest.mark.parametrize("spelling", [tag_events.FROZEN, os.path.join("data", "2026", "events.json"),
                                      os.path.join("data", "2026", "..", "2026", "events.json")])
def test_main_refuses_the_frozen_file_before_it_reads_it(monkeypatch, spelling):
    monkeypatch.chdir(ROOT)
    monkeypatch.setattr(tag_events, "call_api", no_model)
    monkeypatch.setattr(tag_events, "call_claude_code", no_model)
    monkeypatch.setattr(sys, "argv", ["tag_events.py", "--file", spelling, "--all"])
    with pytest.raises(SystemExit) as exc:
        tag_events.main()
    assert exc.value.code == tag_events.REFUSAL
    assert "tag_stage.py" in tag_events.REFUSAL and "events_v2.py" in tag_events.REFUSAL


def test_a_copy_elsewhere_is_not_refused(tmp_path, monkeypatch, capsys):
    copy = tmp_path / "events.json"
    copy.write_text(json.dumps({"events": [{"id": "a", "title": "Castle Cast", "track": "Main Programming",
                                            "type": "panel", "speakers": [], "description": "Q&A."}]}),
                    encoding="utf-8")
    monkeypatch.setattr(sys, "argv", ["tag_events.py", "--file", str(copy), "--dry-run"])
    monkeypatch.setattr(tag_events, "call_api", no_model)
    monkeypatch.setattr(tag_events, "call_claude_code", no_model)
    tag_events.main()
    assert "Tagging 1 events in 1 batches" in capsys.readouterr().err


# --- the transport -----------------------------------------------------------

def fake_run(seen, stdout):
    def run(cmd, **kw):
        seen.append((cmd, kw))
        return subprocess.CompletedProcess(cmd, 0, stdout=stdout, stderr="")
    return run


def test_the_prompt_goes_on_stdin_not_on_the_command_line(monkeypatch):
    """Windows caps a command line at 32,767 characters, and a tag stage prompt runs past 30,000."""
    seen = []
    monkeypatch.setattr(tag_events.subprocess, "run", fake_run(seen, "[]"))
    prompt = "Tag these. " + "x" * 40000
    assert tag_events.call_claude_code(prompt, "opus") == "[]"
    cmd, kw = seen[0]
    assert kw["input"] == prompt and kw["encoding"] == "utf-8"
    assert cmd == ["claude", "-p", "--output-format", "text", "--model", "opus"]
    assert "cwd" not in kw                                          # the drafter's call is otherwise as it was


def test_the_tag_stage_call_has_no_tools_and_reads_the_model_that_answered(monkeypatch, tmp_path):
    monkeypatch.setattr(tag_events, "ISOLATED_DIR", str(tmp_path / "tagger"))
    reply = {"type": "result", "subtype": "success", "is_error": False, "result": '[{"id": "e1"}]',
             "usage": {"input_tokens": 10, "output_tokens": 20},
             "modelUsage": {"claude-haiku-4-5-20251001": {"outputTokens": 3},
                            "claude-sonnet-4-6": {"outputTokens": 900}}}
    seen = []
    monkeypatch.setattr(tag_events.subprocess, "run", fake_run(seen, json.dumps(reply)))
    meta = {}
    assert tag_events.call_claude_code("prompt", "sonnet", isolated=True, meta=meta) == '[{"id": "e1"}]'
    cmd, kw = seen[0]
    assert cmd == ["claude", "-p", "--output-format", "json", "--tools", "", "--strict-mcp-config",
                   "--no-session-persistence", "--model", "sonnet"]
    assert kw["input"] == "prompt" and kw["cwd"] == str(tmp_path / "tagger") and os.listdir(kw["cwd"]) == []
    assert meta == {"model": "claude-sonnet-4-6", "usage": {"input_tokens": 10, "output_tokens": 20}}


def test_the_tag_stage_call_fails_on_an_error_reply_and_never_falls_back(monkeypatch, tmp_path):
    monkeypatch.setattr(tag_events, "ISOLATED_DIR", str(tmp_path / "tagger"))
    seen = []
    monkeypatch.setattr(tag_events.subprocess, "run",
                        fake_run(seen, json.dumps({"subtype": "error_max_turns", "is_error": True, "result": "no"})))
    with pytest.raises(RuntimeError):
        tag_events.call_claude_code("prompt", "sonnet", isolated=True)
    assert len(seen) == 1


def test_the_tag_stage_directory_must_be_empty(monkeypatch, tmp_path):
    monkeypatch.setattr(tag_events, "ISOLATED_DIR", str(tmp_path))
    (tmp_path / "CLAUDE.md").write_text("Read the docs first.", encoding="utf-8")
    with pytest.raises(RuntimeError):
        tag_events.isolated_dir()
