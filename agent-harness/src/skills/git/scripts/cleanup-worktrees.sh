#!/usr/bin/env bash

set -u
set -o pipefail

usage() {
  cat <<'EOF'
Usage: cleanup-worktrees.sh --base <local-branch> [--remove]

Preview clean secondary worktrees whose branches are merged into the base.
Pass --remove to remove eligible worktrees without deleting their branches.
EOF
}

base=""
remove=false

while (($#)); do
  case "$1" in
    --base)
      [[ $# -ge 2 ]] || { echo "error: --base requires a local branch" >&2; exit 2; }
      base=$2
      shift 2
      ;;
    --remove)
      remove=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

[[ -n "$base" ]] || { echo "error: --base is required" >&2; usage >&2; exit 2; }

git rev-parse --git-common-dir >/dev/null 2>&1 || {
  echo "error: run this helper inside a Git repository" >&2
  exit 2
}

case "$base" in
  refs/heads/*) base_ref=$base ;;
  *) base_ref="refs/heads/$base" ;;
esac

git show-ref --verify --quiet "$base_ref" || {
  echo "error: local base branch not found: $base" >&2
  exit 2
}

current_root=$(git rev-parse --show-toplevel) || exit 2
primary_path=""
record_count=0
eligible_count=0

process_worktree() {
  local path=$1
  local branch_ref=$2
  local state=$3
  local status_output merge_status branch_name

  record_count=$((record_count + 1))
  if ((record_count == 1)); then
    primary_path=$path
    echo "SKIP $path: primary worktree"
    return
  fi

  if [[ "$path" == "$current_root" ]]; then
    echo "SKIP $path: current worktree"
    return
  fi

  case "$state" in
    *locked*) echo "SKIP $path: locked worktree"; return ;;
    *prunable*) echo "SKIP $path: prunable worktree metadata"; return ;;
    *detached*) echo "SKIP $path: detached HEAD"; return ;;
  esac

  if [[ -z "$branch_ref" || "$branch_ref" != refs/heads/* ]]; then
    echo "SKIP $path: no named local branch"
    return
  fi

  if [[ ! -d "$path" ]]; then
    echo "SKIP $path: worktree path is missing"
    return
  fi

  if ! status_output=$(git -C "$path" status --porcelain=v1 --untracked-files=all); then
    echo "SKIP $path: unable to read worktree status"
    return
  fi
  if [[ -n "$status_output" ]]; then
    echo "SKIP $path: dirty worktree"
    return
  fi

  git merge-base --is-ancestor "$branch_ref" "$base_ref" >/dev/null 2>&1
  merge_status=$?
  if ((merge_status == 1)); then
    echo "SKIP $path: branch is not merged into $base"
    return
  elif ((merge_status != 0)); then
    echo "SKIP $path: unable to verify merge state"
    return
  fi

  branch_name=${branch_ref#refs/heads/}
  eligible_count=$((eligible_count + 1))
  if [[ "$remove" == true ]]; then
    if git worktree remove "$path"; then
      echo "REMOVED $path [$branch_name]"
    else
      echo "SKIP $path: Git refused removal" >&2
    fi
  else
    echo "ELIGIBLE $path [$branch_name]: merged into $base"
  fi
}

path=""
branch_ref=""
state=""
while IFS= read -r -d '' field; do
  if [[ -z "$field" ]]; then
    if [[ -n "$path" ]]; then
      process_worktree "$path" "$branch_ref" "$state"
    fi
    path=""
    branch_ref=""
    state=""
    continue
  fi

  case "$field" in
    worktree\ *)
      [[ -z "$path" ]] || { echo "error: malformed worktree record" >&2; exit 2; }
      path=${field#worktree }
      ;;
    HEAD\ *) ;;
    branch\ *) branch_ref=${field#branch } ;;
    bare) state="$state bare" ;;
    detached) state="$state detached" ;;
    locked*) state="$state locked" ;;
    prunable*) state="$state prunable" ;;
    *) echo "error: unrecognized worktree field: $field" >&2; exit 2 ;;
  esac
done < <(git worktree list --porcelain -z)

[[ -z "$path" ]] || { echo "error: unterminated worktree record" >&2; exit 2; }

if ((eligible_count == 0)); then
  echo "No eligible worktrees."
elif [[ "$remove" == false ]]; then
  echo "Preview only. Re-run with --remove to remove $eligible_count eligible worktree(s)."
fi
