"""Configuration file for the Sphinx documentation builder."""

import sys
from pathlib import Path
from subprocess import CalledProcessError, check_output

import requests

# -- General configuration ------------------------------------------------

project = "argocd-ioc-monitor"

# Get version from git
root = Path(__file__).absolute().parent.parent
try:
    git_describe = check_output(
        "git describe --tags --always".split(), cwd=root
    ).decode().strip()
except CalledProcessError:
    git_describe = "dev"

release = git_describe
if "+" in release or "-" in release:
    try:
        version = check_output(
            "git branch --show-current".split(), cwd=root
        ).decode().strip() or "dev"
    except CalledProcessError:
        version = "dev"
else:
    version = release

extensions = [
    "sphinx.ext.intersphinx",
    "sphinx_copybutton",
    "sphinx_design",
    "myst_parser",
    "sphinxcontrib.mermaid",
]

myst_enable_extensions = ["colon_fence"]

nitpicky = True

master_doc = "index"

exclude_patterns = ["_build"]

pygments_style = "sphinx"

linkcheck_ignore = [r"http://localhost:\d+/"]

copybutton_prompt_text = r">>> |\.\.\. |\$ |In \[\d*\]: | {2,5}\.\.\.: | {5,8}: "
copybutton_prompt_is_regexp = True

# -- Options for HTML output -------------------------------------------------

html_theme = "pydata_sphinx_theme"
github_repo = "argocd-ioc-monitor"
github_user = "epics-containers"
switcher_json = f"https://{github_user}.github.io/{github_repo}/switcher.json"
switcher_exists = requests.get(switcher_json).ok
if not switcher_exists:
    print(
        "*** Can't read version switcher, is GitHub pages enabled? \n"
        "    Once Docs CI job has successfully run once, set the "
        "Github pages source branch to be 'gh-pages' at:\n"
        f"    https://github.com/{github_user}/{github_repo}/settings/pages",
        file=sys.stderr,
    )

html_theme_options = {
    "logo": {
        "text": project,
    },
    "use_edit_page_button": True,
    "github_url": f"https://github.com/{github_user}/{github_repo}",
    "switcher": {
        "json_url": switcher_json,
        "version_match": version,
    },
    "check_switcher": False,
    "navbar_end": ["theme-switcher", "icon-links", "version-switcher"],
    "navigation_with_keys": False,
}

html_context = {
    "github_user": github_user,
    "github_repo": github_repo,
    "github_version": version,
    "doc_path": "docs",
}

html_show_sphinx = False
html_show_copyright = False
