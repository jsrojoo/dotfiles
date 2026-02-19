#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  group-patches.sh [--staged] [--dry-run] [-o OUT_DIR] group=item[,item...] [group=item[,item...]] ...

Examples:
  group-patches.sh -o /tmp/patches api=src/api,src/models ui=src/ui
  group-patches.sh --staged chore=README.md,docs/*
  group-patches.sh api=src/a.py:10-30,src/b.py:5-9
  group-patches.sh api=src/a.py:10-30,!src/a.py:15-18

Notes:
  - Quote globs to avoid shell expansion, e.g. "ui=src/ui/*,assets/*"
  - Line ranges are based on the new file positions in diff hunks.
  - Prefix a line range with ! to exclude it.
  - Paths are passed to git as pathspecs.
EOF
}

out_dir="${PWD}/patches"
diff_mode="worktree"
dry_run=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    -o|--out-dir)
      out_dir="${2:-}"
      shift 2
      ;;
    --staged|--cached)
      diff_mode="staged"
      shift
      ;;
    --dry-run)
      dry_run=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      break
      ;;
  esac
done

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

mkdir -p "$out_dir"

repo_root="$(git --no-pager rev-parse --show-toplevel)"

diff_args=()
if [[ "$diff_mode" == "staged" ]]; then
  diff_args+=(--cached)
fi

for group_spec in "$@"; do
  if [[ "$group_spec" != *"="* ]]; then
    printf 'Invalid group spec: %s (expected group=path[,path...])\n' "$group_spec" >&2
    exit 1
  fi

  group_name="${group_spec%%=*}"
  paths_csv="${group_spec#*=}"

  if [[ -z "$group_name" || -z "$paths_csv" ]]; then
    printf 'Invalid group spec: %s (empty group or paths)\n' "$group_spec" >&2
    exit 1
  fi

  IFS=',' read -r -a group_items <<< "$paths_csv"
  pathspecs=()
  include_ranges=()
  exclude_ranges=()

  for item in "${group_items[@]}"; do
    if [[ "$item" == \!*:* || "$item" == -*:* ]]; then
      item="${item#?}"
      path="${item%%:*}"
      range="${item#*:}"
      include_flag="exclude"
    elif [[ "$item" == *:* ]]; then
      path="${item%%:*}"
      range="${item#*:}"
      include_flag="include"
    else
      path="$item"
      range=""
      include_flag="path"
    fi

    if [[ -z "$path" ]]; then
      printf 'Invalid item in group %s: %s\n' "$group_name" "$item" >&2
      exit 1
    fi

    pathspecs+=("$path")

    if [[ -n "$range" ]]; then
      if [[ ! "$range" =~ ^[0-9]+-[0-9]+$ ]]; then
        printf 'Invalid line range in group %s: %s\n' "$group_name" "$range" >&2
        exit 1
      fi
      if [[ "$include_flag" == "exclude" ]]; then
        exclude_ranges+=("${path}:${range}")
      else
        include_ranges+=("${path}:${range}")
      fi
    fi
  done

  safe_group_name="$(printf '%s' "$group_name" | tr -c 'A-Za-z0-9._-' '_')"
  out_file="${out_dir}/${safe_group_name}.patch"
  out_target="$out_file"
  if [[ "$dry_run" -eq 1 ]]; then
    out_target="/dev/null"
  fi

  if git --no-pager -C "$repo_root" diff "${diff_args[@]}" --quiet -- "${pathspecs[@]}"; then
    printf 'No changes for group %s, skipping\n' "$group_name" >&2
    continue
  fi

  if [[ "${#include_ranges[@]}" -gt 0 || "${#exclude_ranges[@]}" -gt 0 ]]; then
    ranges_include="$(printf '%s;' "${include_ranges[@]}")"
    ranges_exclude="$(printf '%s;' "${exclude_ranges[@]}")"
    git --no-pager -C "$repo_root" diff "${diff_args[@]}" -U0 --patch -- "${pathspecs[@]}" \
      | awk -v includes="$ranges_include" -v excludes="$ranges_exclude" -v dry_run="$dry_run" -v group="$group_name" '
        BEGIN {
          split(includes, inc_entries, ";")
          for (i = 1; i <= length(inc_entries); i++) {
            if (inc_entries[i] == "") continue
            split(inc_entries[i], a, ":")
            file = a[1]
            split(a[2], b, "-")
            inc_count[file]++
            inc_start[file, inc_count[file]] = b[1] + 0
            inc_end[file, inc_count[file]] = b[2] + 0
            inc_files[file] = 1
          }
          split(excludes, exc_entries, ";")
          for (i = 1; i <= length(exc_entries); i++) {
            if (exc_entries[i] == "") continue
            split(exc_entries[i], a, ":")
            file = a[1]
            split(a[2], b, "-")
            exc_count[file]++
            exc_start[file, exc_count[file]] = b[1] + 0
            exc_end[file, exc_count[file]] = b[2] + 0
            exc_files[file] = 1
          }
        }

        function overlaps(start1, end1, start2, end2) {
          return !(end1 < start2 || start1 > end2)
        }

        function hunk_keep(file, new_start, new_count,    i, h_start, h_end) {
          h_start = new_start
          h_end = new_start + new_count - 1
          if (new_count == 0) {
            h_end = h_start
          }
          if (file in inc_files) {
            for (i = 1; i <= inc_count[file]; i++) {
              if (overlaps(h_start, h_end, inc_start[file, i], inc_end[file, i])) {
                return 1
              }
            }
            return 0
          }
          return 1
        }

        function hunk_excluded(file, new_start, new_count,    i, h_start, h_end) {
          h_start = new_start
          h_end = new_start + new_count - 1
          if (new_count == 0) {
            h_end = h_start
          }
          if (!(file in exc_files)) {
            return 0
          }
          for (i = 1; i <= exc_count[file]; i++) {
            if (overlaps(h_start, h_end, exc_start[file, i], exc_end[file, i])) {
              return 1
            }
          }
          return 0
        }

        /^diff --git / {
          header = $0 "\n"
          header_printed = 0
          current_file = ""
          in_hunk = 0
          keep_hunk = 0
          next
        }

        /^index / || /^--- / || /^\+\+\+ / {
          header = header $0 "\n"
          if ($1 == "+++") {
            if ($2 == "/dev/null") {
              current_file = ""
            } else {
              current_file = substr($2, 3)
            }
          }
          next
        }

        /^@@ / {
          in_hunk = 1
          keep_hunk = 0
          decision = "skip"
          if (current_file != "") {
            if (match($0, /\+[0-9]+(,[0-9]+)?/)) {
              range = substr($0, RSTART + 1, RLENGTH - 1)
              split(range, parts, ",")
              new_start = parts[1] + 0
              new_count = (length(parts) > 1 ? parts[2] + 0 : 1)
              if (hunk_keep(current_file, new_start, new_count) && !hunk_excluded(current_file, new_start, new_count)) {
                keep_hunk = 1
                decision = "keep"
              } else if (hunk_excluded(current_file, new_start, new_count)) {
                decision = "exclude"
              }
            }
          }
          if (dry_run == 1 && current_file != "") {
            hunk_label = new_start ":" new_count
            printf "group=%s file=%s hunk=+%s %s\n", group, current_file, hunk_label, decision > "/dev/stderr"
          }
          if (keep_hunk && !header_printed) {
            printf "%s", header
            header_printed = 1
          }
          if (keep_hunk) {
            print $0
          }
          next
        }

        {
          if (in_hunk && keep_hunk) {
            print $0
          }
        }
      ' > "$out_target"
  else
    git --no-pager -C "$repo_root" diff "${diff_args[@]}" -U0 --patch -- "${pathspecs[@]}" > "$out_target"
  fi

  if [[ "$dry_run" -eq 1 ]]; then
    printf 'Dry run for %s\n' "$group_name"
  else
    printf 'Wrote %s\n' "$out_file"
  fi
done
