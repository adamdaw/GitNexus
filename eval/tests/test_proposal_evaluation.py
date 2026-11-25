"""Exercise the native controller, real model CLI, both OCI toolsets and hidden grading."""

import json
import os
import subprocess
import sys
import time
from pathlib import Path
from types import SimpleNamespace

import pytest
import yaml

from workflow_bench import proposal_evaluation as evaluator, release_report
from workflow_bench.mock_provider import MockProvider, Reply
from workflow_bench.oracle_assets import ORACLE_ROOT, capture_task_oracle
from workflow_bench.oci_worker import run_worker
from workflow_bench.task_assets import TaskAssetCache


native = pytest.mark.skipif(
    os.environ.get("GITNEXUS_REQUIRE_PROPOSAL_CANARY") != "1",
    reason="the native Linux matrix provisions local Docker Engine",
)


def test_live_cost_dispatch_uses_the_trusted_harness_and_scopes_the_model_key():
    workflow = yaml.safe_load(
        (Path(__file__).resolve().parents[2] / ".github/workflows/proposal-evaluation.yml").read_text()
    )
    assert set(workflow[True]) == {"workflow_dispatch"}
    choices = workflow[True]["workflow_dispatch"]["inputs"]
    assert choices["ubuntu"]["options"] == ["ubuntu-24.04", "ubuntu-26.04"]
    measure = workflow["jobs"]["measure"]
    assert "github.ref == 'refs/heads/main'" in measure["if"] and measure["environment"] == "gitnexus-evolution"
    keyed = [s for s in measure["steps"] if "GITNEXUS_BENCH_ANTHROPIC_API_KEY" in s.get("env", {})]
    assert len(keyed) == 1 and "workflow_bench.proposal_evaluation" in keyed[0]["run"]
    assert '--max-budget-usd "$SESSION_BUDGET"' in keyed[0]["run"]


@pytest.mark.parametrize(("cost", "expected"), [(0.012, "grading-infrastructure"), (None, "usage-missing")])
def test_unusable_measurement_preserves_model_usage_and_stops_the_sweep(monkeypatch, tmp_path, cost, expected):
    source = evaluator.Source(tmp_path, tmp_path, [])
    task = {"id": "sample", "prompt": "Inspect this fixture.", "ref": "a" * 40}
    prepared = evaluator.PreparedTask(
        task, tmp_path, source, SimpleNamespace(digest="d"), SimpleNamespace(dependency_binding={})
    )
    client = evaluator.ModelClient(Path("claude"), "claude-sonnet-4-6", "high", "fixture")
    monkeypatch.setattr(
        evaluator, "propose", lambda *_a, **_kw: dict(ok=True, cost_usd=cost, input_tokens=14, error_kind=None)
    )

    def unavailable(*_args, **_kwargs):
        assert cost is not None
        raise evaluator.SandboxError("the worker did not start")

    monkeypatch.setattr(evaluator, "grade", unavailable)
    row = evaluator._measure(
        prepared,
        arm="baseline",
        run=0,
        client=client,
        out=tmp_path,
        parent=tmp_path,
        metadata={"runtime_sha": "a" * 40, "harness_sha": "b" * 40, "usage_source": "fixture"},
        version=release_report.PROPOSAL_CLIENT,
    )
    assert not row["ok"] and not row["resolved"] and row["error_kind"] == expected
    assert row["cost_usd"] == cost and row["input_tokens"] == 14


def stopped_early(report):
    """Why the paired sweep produced fewer cells than expected."""
    rows = [
        {key: row.get(key) for key in ("arm", "run", "ok", "error_kind", "error_detail")}
        for row in report.get("per_run", [])
    ]
    return json.dumps({"complete": report.get("complete"), "problems": report.get("problems"), "rows": rows}, indent=2)


@pytest.mark.parametrize(
    ("session", "grader_error", "expected"),
    [
        (
            dict(
                ok=False,
                cost_usd=None,
                error_kind="session-error",
                error_detail={"stdout_tail": "sk-ant-api03-leakedkey123 offline-key " + "x" * 5000},
            ),
            None,
            "session-error",
        ),
        (
            dict(ok=True, cost_usd=0.01, error_kind=None, error_detail=None),
            evaluator.SandboxError("Authorization: Bearer offline-key worker did not start"),
            "grading-infrastructure",
        ),
        (
            dict(ok=True, cost_usd=0.01, error_kind=None, error_detail=None),
            evaluator.ManagedProcessError(
                ["docker", "run"],
                SimpleNamespace(state="exited", returncode=125, detail="Authorization: Bearer offline-key", stderr_tail=""),
            ),
            "grading-infrastructure",
        ),
    ],
)
def test_failed_measurement_keeps_a_redacted_bounded_reason(monkeypatch, tmp_path, session, grader_error, expected):
    source = evaluator.Source(tmp_path, tmp_path, [])
    task = {"id": "sample", "prompt": "Inspect this fixture.", "ref": "a" * 40}
    prepared = evaluator.PreparedTask(
        task, tmp_path, source, SimpleNamespace(digest="d"), SimpleNamespace(dependency_binding={})
    )
    client = evaluator.ModelClient(Path("claude"), "claude-sonnet-4-6", "high", "offline-key")
    monkeypatch.setattr(evaluator, "propose", lambda *_a, **_kw: dict(session, input_tokens=14))

    def unavailable(*_args, **_kwargs):
        raise grader_error

    monkeypatch.setattr(evaluator, "grade", unavailable)
    metadata = {"runtime_sha": "a" * 40, "harness_sha": "b" * 40, "usage_source": "fixture"}
    row = evaluator._measure(
        prepared,
        arm="baseline",
        run=0,
        client=client,
        out=tmp_path,
        parent=tmp_path,
        metadata=metadata,
        version=release_report.PROPOSAL_CLIENT,
    )
    assert not row["ok"] and row["error_kind"] == expected
    detail = row["error_detail"]
    assert len(detail) <= evaluator.MAX_ERROR_DETAIL_CHARS
    assert "offline-key" not in detail and "leakedkey123" not in detail
    if grader_error is None:
        assert detail.startswith('{"stdout_tail": "[REDACTED] [REDACTED] xxx') and detail.endswith(" chars]")
        assert "…[truncated " in detail
    elif isinstance(grader_error, evaluator.SandboxError):
        assert detail == "SandboxError: Authorization: Bearer [REDACTED] worker did not start"
    else:
        assert detail == "ManagedProcessError: managed command failed (exited, exit=125): Authorization: Bearer [REDACTED]"
    # The incomplete failure receipt carries the reason through to the published report.
    report = release_report.build_report(
        [row],
        {
            **metadata,
            "task_set_digest": "1" * 64,
            "model": client.model,
            "effort": "high",
            "runs": 3,
            "tasks": {"sample": {"sha": "a" * 40, "oracle_digest": "d"}},
            "executor": release_report.PROPOSAL_EXECUTOR,
        },
    )
    assert not report["complete"] and report["per_run"][0]["error_detail"] == detail
    assert json.loads(stopped_early(report))["rows"][0]["error_detail"] == detail


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("push failed: ghp_abcdefgh12345678 rejected", "push failed: [REDACTED] rejected"),
        ("clone https://ci:hunter2@github.com/o/r.git failed", "clone https://[REDACTED]@github.com/o/r.git failed"),
    ],
)
def test_failure_detail_redacts_github_tokens_and_url_credentials(raw, expected):
    assert evaluator.failure_detail(raw) == expected


def test_successful_measurement_reports_no_error_detail(monkeypatch, tmp_path):
    source = evaluator.Source(tmp_path, tmp_path, [])
    task = {"id": "sample", "prompt": "Inspect this fixture.", "ref": "a" * 40}
    prepared = evaluator.PreparedTask(
        task, tmp_path, source, SimpleNamespace(digest="d"), SimpleNamespace(dependency_binding={})
    )
    client = evaluator.ModelClient(Path("claude"), "claude-sonnet-4-6", "high", "offline-key")
    monkeypatch.setattr(
        evaluator, "propose", lambda *_a, **_kw: dict(ok=True, cost_usd=0.01, error_kind=None, error_detail=None)
    )
    monkeypatch.setattr(evaluator, "grade", lambda *_a, **_kw: (True, True, True, None))
    row = evaluator._measure(
        prepared,
        arm="baseline",
        run=0,
        client=client,
        out=tmp_path,
        parent=tmp_path,
        metadata={"runtime_sha": "a" * 40, "harness_sha": "b" * 40, "usage_source": "fixture"},
        version=release_report.PROPOSAL_CLIENT,
    )
    assert row["ok"] and row["resolved"] and "error_detail" not in row


@native
def test_offline_worker_credentials_namespaces_and_readonly_checkout(tmp_path, monkeypatch):
    checkout = tmp_path / "checkout"
    checkout.mkdir()
    (checkout / "source").write_text("ordinary task source")
    host_file = tmp_path / "controller-only"
    host_file.write_text("private fixture")
    monkeypatch.setenv("GNX_CONTROLLER_TEST", "private fixture")
    script = """
import errno, json, os, pathlib, sys
from pathlib import Path
status = dict(line.split(':',1) for line in Path('/proc/self/status').read_text().splitlines() if ':' in line)
try:
    Path('/workspace/source').write_text('wrong')
except OSError as exc:
    assert exc.errno == errno.EROFS
else:
    raise AssertionError('read-only checkout was writable')
assert Path('/workspace/source').read_text() == 'ordinary task source'
assert 'GNX_CONTROLLER_TEST' not in os.environ and not Path(sys.argv[1]).exists()
assert not Path('/var/run/docker.sock').exists()
assert os.getuid() != 0 and int(status['CapEff'],16) == 0
assert int(status['NoNewPrivs']) == 1 and int(status['Seccomp']) == 2
assert Path('/proc/self/attr/current').read_text().strip() == 'docker-default (enforce)'
assert os.listdir('/sys/class/net') == ['lo']
print(json.dumps([os.readlink('/proc/self/ns/'+name) for name in ('pid','mnt','net')]))
"""
    result = run_worker(
        ["/usr/bin/python3", "-c", script, str(host_file)], checkout=checkout, readonly=True, timeout=90
    )
    assert all(
        child != os.readlink("/proc/self/ns/" + name)
        for child, name in zip(json.loads(result.stdout_tail), ("pid", "mnt", "net"), strict=True)
    )


@native
def test_offline_worker_exits_when_the_controller_dies(tmp_path):
    child = "from pathlib import Path; import time; Path('ready').touch(); time.sleep(3); Path('late').touch()"
    driver = (
        "from pathlib import Path; import sys; from workflow_bench.oci_worker import run_worker; "
        "run_worker(['/usr/bin/python3','-c',sys.argv[2]],checkout=Path(sys.argv[1]),readonly=False,timeout=60)"
    )
    process = subprocess.Popen([sys.executable, "-c", driver, str(tmp_path), child])
    try:
        deadline = time.monotonic() + 60
        while not (tmp_path / "ready").exists() and process.poll() is None and time.monotonic() < deadline:
            time.sleep(0.05)
        assert (tmp_path / "ready").exists()
    finally:
        process.kill()
        process.wait(timeout=5)
    time.sleep(3.2)
    assert not (tmp_path / "late").exists()


@native
def test_all_pinned_proposal_graders(tmp_path):
    repo = Path(os.environ["GITNEXUS_ORACLE_TASK_DEPENDENCIES"])
    tasks, _, pins = release_report.suite_binding()
    sha = release_report.pinned_task_sha(tasks)
    assert release_report._git_sha(repo) == sha
    assert {task["id"] for task in tasks} == set(evaluator.REFERENCES)
    for task in tasks:
        task["repo"] = str(repo)
    runtime = Path(os.environ.get("GITNEXUS_CANARY_RUNTIME_ROOT", Path(__file__).resolve().parents[2]))
    client = evaluator.ModelClient(Path(os.environ["CLAUDE_CANARY_BIN"]), "claude-sonnet-4-6", "high", "offline-only")
    with TaskAssetCache(tmp_path / "assets") as cache:
        prepared = evaluator._prepare_tasks(
            tasks,
            {"tasks": pins},
            evaluator.trusted_gitnexus_runtime_mounts(root=runtime),
            client,
            tmp_path,
            cache,
            ORACLE_ROOT,
            ORACLE_ROOT / "reference",
        )
    assert [item.task["id"] for item in prepared] == [task["id"] for task in tasks]


@native
def test_native_paired_proposal_cost_and_grading(tmp_path):
    repo = tmp_path / "candidate"
    (repo / "src").mkdir(parents=True)
    before = "export const total = (a, b) => a - b;"
    (repo / "src/sum.mjs").write_text(before + "\n")
    for command in (
        ["init", "-q"],
        ["add", "."],
        ["-c", "user.name=Test", "-c", "user.email=ci@example.test", "commit", "-qm", "fixture"],
    ):
        subprocess.run(["git", "-C", str(repo), *command], check=True, capture_output=True)
    sha = release_report._git_sha(repo)
    oracles = tmp_path / "hidden"
    reference = oracles / "reference"
    reference.mkdir(parents=True)
    (oracles / "sum.mjs").write_text(
        "import assert from 'node:assert/strict'; import {total} from '../src/sum.mjs'; assert.equal(total(1,2),3);"
    )

    def patch(op):
        return (
            "diff --git a/src/sum.mjs b/src/sum.mjs\n--- a/src/sum.mjs\n+++ b/src/sum.mjs\n"
            "@@ -1 +1 @@\n-" + before + "\n+" + before.replace("a - b", f"a {op} b") + "\n"
        )

    (reference / "sum.patch").write_text(patch("+"))
    task = {
        "id": "sum",
        "class": "bug-fix",
        "repo": str(repo),
        "ref": sha,
        "prompt": "Fix the total function.",
        "verify": "node --check src/sum.mjs",
        "oracle": {
            "command": 'node "$GITNEXUS_BENCH_ORACLE_ROOT/sum.mjs"',
            "files": [{"source": "sum.mjs", "target": "sum.mjs"}],
        },
    }
    model = "claude-sonnet-4-6"
    meta = {
        "runtime_sha": sha,
        "harness_sha": sha,
        "task_set_digest": "1" * 64,
        "model": model,
        "effort": "high",
        "runs": 3,
        "tasks": {"sum": {"sha": sha, "oracle_digest": capture_task_oracle(task, root=oracles).digest}},
    }
    observed = {False: 0, True: 0}
    tool_results = []

    class Scripted(MockProvider):
        def next_reply(self):
            body = self.requests[-1].body
            names = {tool["name"] for tool in body.get("tools", [])}
            augmented = "mcp__gitnexus__list_repos" in names
            results = [
                b
                for msg in body["messages"]
                if isinstance(msg.get("content"), list)
                for b in msg["content"]
                if b["type"] == "tool_result"
            ]
            if not results:
                observed[augmented] += 1
                op = "*" if augmented and observed[True] == 3 else "+"
                return Reply(
                    tools=[
                        {"name": "mcp__checkout__read_file", "input": {"path": "src/sum.mjs", "start": 1}},
                        {"name": "mcp__checkout__submit_patch", "input": {"patch": patch(op)}},
                        *([{"name": "mcp__gitnexus__list_repos", "input": {}}] if augmented else []),
                    ]
                )
            tool_results.append((augmented, names, {r["tool_use_id"]: r for r in results}))
            return Reply(text="Finished.")

    out = tmp_path / "out"
    runtime = Path(os.environ.get("GITNEXUS_CANARY_RUNTIME_ROOT", Path(__file__).resolve().parents[2]))
    with Scripted() as provider:
        client = evaluator.ModelClient(
            Path(os.environ["CLAUDE_CANARY_BIN"]), model, "high", "offline-fixture", provider.base_url, timeout=150
        )
        report = evaluator.evaluate([task], meta, runtime_root=runtime, client=client, out=out, oracle_root=oracles)
        assert len(provider.requests) == 12, stopped_early(report)
    assert observed == {False: 3, True: 3}
    assert len(tool_results) == 6
    for augmented, names, results in tool_results:
        assert names == {f"mcp__checkout__{name}" for name in evaluator.TOOLS} | (
            names.intersection(evaluator.GITNEXUS_READ_ONLY_TOOLS) if augmented else set()
        )
        assert not any(r.get("is_error") for r in results.values())
        assert before in str(results["toolu_mock_0"]["content"])
        assert "Patch submitted" in str(results["toolu_mock_1"]["content"])
        if augmented:
            assert "benchmark-target" in str(results["toolu_mock_2"]["content"])
    assert report["complete"] and report["schema"] == release_report.PROPOSAL_SCHEMA
    assert report["arms"]["baseline_nomcp"]["solved"] == 3 and report["arms"]["baseline"]["solved"] == 2
    for row in report["per_run"]:
        assert row["input_tokens"] == 22 and row["output_tokens"] == 14 and row["cost_usd"] == pytest.approx(0.000276)
    assert json.loads((out / "proposal-evaluation.json").read_text()) == report
    # Historical release comparisons must reject a different measured toolset.
    with pytest.raises(ValueError, match="unsupported"):
        release_report.validate_report(report, runtime_sha=sha, task_set_digest=meta["task_set_digest"])
