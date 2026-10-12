#!/bin/bash
# Install Drydock on a Mac (also works on Linux with Homebrew or apt).
#
# What it does, in order, skipping anything already present:
#   1. Apple's command-line tools (gives you git)           4. The Claude desktop app (opens the download page)
#   2. Node.js, the LTS release, from nodejs.org             5. Claude Code's command-line tool
#   3. GitHub's command-line tool, gh                       6. The Drydock plugin, from github.com/wjp3/drydock
#   7. A Builds folder in your home folder with a START HERE note        8. Sign-ins, in your browser (GitHub, and Netlify if chosen)
#
# It never asks for a password itself. Your Mac asks for the computer password when a program is installed,
# and every sign-in happens in your browser. Safe to run more than once.
#
# Run it: double-click Install-Drydock.command (the first time, right-click it and choose Open),
# or paste this in Terminal:  bash <(curl -fsSL https://raw.githubusercontent.com/wjp3/drydock/v0.1.0/install/Install-Drydock.command)
# Flags: --dry-run (only say what would happen)   --yes (no pauses)   --with-netlify (also install the Netlify tool)

set -u
DRY_RUN=0; YES=0; WITH_NETLIFY=0
for a in "$@"; do case "$a" in --dry-run) DRY_RUN=1;; --yes) YES=1;; --with-netlify) WITH_NETLIFY=1;; esac; done
REPO="wjp3/drydock"
BUILDS="$HOME/Builds"
TMP="$(mktemp -d)"
export PATH="$HOME/.local/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"

bold() { printf '\n\033[1m%s\033[0m\n' "$*"; }
note() { printf '   %s\n' "$*"; }
run()  { if [ "$DRY_RUN" = 1 ]; then note "(dry run) $*"; else "$@"; fi; }
pause() { if [ "$YES" = 1 ] || [ "$DRY_RUN" = 1 ]; then return; fi; printf '   Press Enter to continue (or Ctrl+C to stop). '; read -r _; }
have() { command -v "$1" >/dev/null 2>&1; }
node_major() { node --version 2>/dev/null | sed 's/^v//' | cut -d. -f1; }

bold "Drydock installer"
note "This sets up this computer to build with Claude Code and Drydock. It takes 10 to 20 minutes."
note "Your Mac may ask for its password once or twice when a program is installed. That is normal."
pause

# 1. git (via Apple's command-line tools)
bold "1 of 8: git"
if have git && git --version >/dev/null 2>&1; then note "git is already here: $(git --version)"
else
  if [ "$(uname)" = "Darwin" ]; then
    note "Asking macOS to install its command-line tools. A window will appear: click Install, then wait for it to finish."
    run xcode-select --install 2>/dev/null || true
    if [ "$DRY_RUN" = 0 ]; then
      i=0; until xcode-select -p >/dev/null 2>&1 || [ $i -ge 180 ]; do sleep 10; i=$((i+1)); done
      have git && note "git installed: $(git --version)" || { note "git did not install. Finish the Apple window, then run this installer again."; exit 1; }
    fi
  else
    have apt-get && run sudo apt-get install -y git || note "Install git with your package manager, then run this again."
  fi
fi

# 2. Node.js
bold "2 of 8: Node.js (version 20 or newer)"
if have node && [ "$(node_major)" -ge 20 ] 2>/dev/null; then note "Node is already here: $(node --version)"
else
  if have brew; then run brew install node
  elif [ "$(uname)" = "Darwin" ]; then
    V=$(curl -fsSL https://nodejs.org/dist/index.json | tr '}' '\n' | grep -m1 '"lts":"[A-Za-z]' | grep -o 'v[0-9]*\.[0-9]*\.[0-9]*' | head -1)
    [ -n "$V" ] || { note "Could not find the Node LTS version. Check your internet connection and run again."; exit 1; }
    note "Downloading Node $V from nodejs.org ..."
    run curl -fL -o "$TMP/node.pkg" "https://nodejs.org/dist/$V/node-$V.pkg"
    note "Installing Node. Your Mac will ask for its password."
    run sudo installer -pkg "$TMP/node.pkg" -target /
  else
    note "Install Node 20 or newer from https://nodejs.org (the LTS button), then run this again."; exit 1
  fi
  [ "$DRY_RUN" = 1 ] || { have node && note "Node installed: $(node --version)" || { note "Node did not install."; exit 1; }; }
fi

# 3. gh
bold "3 of 8: GitHub's command-line tool (gh)"
if have gh; then note "gh is already here: $(gh --version | head -1)"
else
  if have brew; then run brew install gh
  elif [ "$(uname)" = "Darwin" ]; then
    TAG=$(curl -fsSLI -o /dev/null -w '%{url_effective}' https://github.com/cli/cli/releases/latest | sed 's#.*/tag/##')
    GV="${TAG#v}"
    [ -n "$GV" ] || { note "Could not find the gh release. Check your internet connection and run again."; exit 1; }
    note "Downloading gh $GV ..."
    run curl -fL -o "$TMP/gh.pkg" "https://github.com/cli/cli/releases/download/${TAG}/gh_${GV}_macOS_universal.pkg"
    note "Installing gh. Your Mac may ask for its password."
    run sudo installer -pkg "$TMP/gh.pkg" -target /
  else
    note "Install gh from https://cli.github.com, then run this again."; exit 1
  fi
fi

# 4. Claude desktop app
bold "4 of 8: the Claude desktop app"
if [ -d "/Applications/Claude.app" ] || [ "$(uname)" != "Darwin" ]; then note "The Claude app is installed (or this is not a Mac)."
else
  note "Opening the download page. Install the app, open it, sign in, then come back here."
  run open "https://claude.com/download"
  if [ "$DRY_RUN" = 0 ]; then
    printf '   Press Enter once the Claude app is installed and signed in. '; read -r _
    [ -d "/Applications/Claude.app" ] || note "I do not see the app yet. You can install it later; everything else continues."
  fi
fi

# 5. Claude Code command-line tool (needed to install the plugin; the desktop app uses it too)
bold "5 of 8: Claude Code's command-line tool"
if have claude; then note "Claude Code is already here: $(claude --version 2>/dev/null | head -1)"
else
  note "Installing Claude Code from claude.ai ..."
  if [ "$DRY_RUN" = 1 ]; then note "(dry run) curl -fsSL https://claude.ai/install.sh | bash"; else curl -fsSL https://claude.ai/install.sh | bash; fi
  export PATH="$HOME/.local/bin:$PATH"
  [ "$DRY_RUN" = 1 ] || { have claude && note "Claude Code installed: $(claude --version 2>/dev/null | head -1)" || { note "Claude Code did not install. Open a new Terminal window and run this installer again."; exit 1; }; }
fi

# 6. Drydock
bold "6 of 8: the Drydock plugin"
if [ "$DRY_RUN" = 1 ]; then note "(dry run) claude plugin marketplace add $REPO; claude plugin install drydock@drydock"
else
  if claude plugin marketplace list 2>/dev/null | grep -q "drydock"; then note "The Drydock marketplace is already added."; else claude plugin marketplace add "$REPO" || { note "Could not add the marketplace. Is the internet connected?"; exit 1; }; fi
  if claude plugin list 2>/dev/null | grep -q "drydock@drydock"; then note "Drydock is already installed."; else claude plugin install drydock@drydock || { note "Could not install the plugin."; exit 1; }; fi
  claude plugin list 2>/dev/null | grep -A3 "drydock@drydock" | sed 's/^/   /'
fi

# 7. Builds folder
bold "7 of 8: a Builds folder"
run mkdir -p "$BUILDS/my-first-build"
if [ "$DRY_RUN" = 0 ]; then cat > "$BUILDS/START HERE.txt" <<'TXT'
START HERE

1. Open the Claude app. Click the Code tab. Open the folder  Builds / my-first-build  (or any folder you make in Builds).
2. In the message box, type:   /drydock:setup     and press Enter. Answer the four questions.
3. Then type:   /drydock:plan     and describe what you want to build, in your own words.
4. Then type:   /drydock:build S0     and watch. When it stops and shows you, try it. Say   next   to continue.
5. When you stop for the day, type:   /drydock:handoff     When you come back, type:   /drydock:wake

Three sentences worth remembering:
   "Show me the evidence."      when something is called done
   "Stop and tell me what's blocking."      when it keeps trying the same thing
   "Handoff."      when the conversation has gotten long or confused (then open a fresh session and type /drydock:wake)

The playbook PDF explains everything else. Nothing goes live without your yes.
TXT
fi
note "Folder: $BUILDS (with a START HERE note)"

# 8. Sign-ins
bold "8 of 8: sign-ins (in your browser)"
if [ "$DRY_RUN" = 1 ]; then note "(dry run) gh auth login --web"; else
  if gh auth status >/dev/null 2>&1; then note "GitHub: already signed in."
  else note "GitHub: a code will appear below and your browser will open. Sign in to GitHub (create a free account first at github.com if you have none), paste the code, click Authorize."; gh auth login --web --git-protocol https || note "GitHub sign-in skipped. Run  gh auth login --web  later."; fi
fi
if [ "$WITH_NETLIFY" = 1 ]; then
  if have netlify; then note "Netlify tool: already here."; else note "Installing the Netlify tool ..."; run npm install -g netlify-cli 2>/dev/null || run sudo npm install -g netlify-cli; fi
  if [ "$DRY_RUN" = 0 ] && have netlify; then netlify status >/dev/null 2>&1 || { note "Netlify: your browser will open. Create a free account at netlify.com if you have none, then click Authorize."; netlify login || true; }; fi
fi

bold "Done."
note "Next: open the Claude app, click Code, open the folder Builds/my-first-build, and type  /drydock:setup"
note "If /drydock:setup is not offered, type  /plugin marketplace add $REPO  then  /plugin install drydock@drydock  in the message box once."
rm -rf "$TMP"
