import casbin
from pathlib import Path

_enforcer: casbin.Enforcer | None = None


def init_enforcer() -> casbin.Enforcer:
    global _enforcer
    base = Path(__file__).parent
    model_path = str(base / "casbin_model.conf")
    policy_path = str(base / "casbin_policy.csv")
    _enforcer = casbin.Enforcer(model_path, policy_path)
    return _enforcer


def get_enforcer() -> casbin.Enforcer:
    if _enforcer is None:
        return init_enforcer()
    return _enforcer
