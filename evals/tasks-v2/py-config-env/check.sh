#!/usr/bin/env bash
# Exit 0 = solved. Runs inside a fresh copy of repo/.
set -e
git diff --quiet HEAD -- tests test || { echo "tests were edited"; exit 1; }
python3 -m unittest discover -s tests -t . -q >/dev/null 2>&1 || { echo "visible tests fail"; exit 1; }
python3 - <<'EOF'
import os, pathlib, tempfile
from app.config import load
from app.main import server_address
ini = pathlib.Path(tempfile.mkdtemp()) / "a.ini"
ini.write_text("[server]\nport = 9000\n")
assert load(str(ini), env={})["server"]["port"] == "9000"
assert load(str(ini), env={"APP_SERVER_PORT": "7000"})["server"]["port"] == "7000", "env beats the INI file"
assert load(env={"APP_LOG_LEVEL": "DEBUG"})["log"]["level"] == "DEBUG", "env beats DEFAULTS"
assert "nothere" not in load(env={"APP_SERVER_NOTHERE": "1"})["server"], "only existing keys"
assert "other" not in load(env={"APP_OTHER_X": "1"}), "only existing sections"
os.environ["APP_SERVER_HOST"] = "0.0.0.0"
assert server_address()[0] == "0.0.0.0", "server_address uses os.environ"
EOF
