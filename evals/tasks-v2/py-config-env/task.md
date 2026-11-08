Add environment-variable overrides to app/config.py. A variable named APP_<SECTION>_<KEY> in upper
case (for example APP_SERVER_PORT) overrides that key and takes precedence over both DEFAULTS and the
INI file. Overrides only apply to sections and keys that already exist. load() must accept an optional
`env` mapping argument (defaulting to os.environ) so it can be tested, and app.main.server_address must
pick overrides up. All existing tests must still pass; do not edit them.
