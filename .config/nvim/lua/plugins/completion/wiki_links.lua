local Source = {}
Source.__index = Source

local default_opts = {
  exclude_paths = { ".git", ".obsidian", "media" },
  filetypes = { "markdown" },
  prefix_min_len = 3,
  root = "~/Documents/work-notes",
}

local cache_file_paths_by_root = {}
local cache_time_by_root = {}
local cache_ttl_ms = 30000

local function source_root_expand(root)
  return vim.fn.fnamemodify(vim.fn.expand(root), ":p:h")
end

local function source_context_prefix_get(context)
  local cursor_col = context.cursor[2]
  local line = context.line
  local line_before_cursor = line:sub(1, cursor_col)
  local wikilink_start = line_before_cursor:find("%[%[[^%]]*$")

  if wikilink_start then
    return line:sub(wikilink_start + 2, cursor_col)
  end

  if context.bounds and context.bounds.length > 0 then
    return line:sub(context.bounds.start_col, context.bounds.start_col + context.bounds.length - 1)
  end

  return ""
end

local function source_text_edit_range_get(context)
  local cursor_col = context.cursor[2]
  local line = context.line
  local line_before_cursor = line:sub(1, cursor_col)
  local wikilink_start = line_before_cursor:find("%[%[[^%]]*$")

  if wikilink_start then
    local close_start = line:find("%]%]", cursor_col + 1)
    local end_col = close_start and (close_start + 1) or cursor_col

    return {
      ["start"] = {
        line = context.cursor[1] - 1,
        character = wikilink_start - 1,
      },
      ["end"] = {
        line = context.cursor[1] - 1,
        character = end_col,
      },
    }
  end

  return {
    ["start"] = {
      line = context.cursor[1] - 1,
      character = context.bounds.start_col - 1,
    },
    ["end"] = {
      line = context.cursor[1] - 1,
      character = context.bounds.start_col + context.bounds.length - 1,
    },
  }
end

local function source_item_from_file_path(file_path, edit_range)
  local label = vim.fn.fnamemodify(file_path, ":t:r")
  local new_text = string.format("[[%s]]", label)

  return {
    detail = file_path,
    filterText = label,
    insertTextFormat = vim.lsp.protocol.InsertTextFormat.PlainText,
    kind = vim.lsp.protocol.CompletionItemKind.File,
    label = label,
    textEdit = {
      newText = new_text,
      range = edit_range,
    },
  }
end

local function source_items_from_file_paths(file_paths, edit_range)
  local items = {}

  for _, file_path in ipairs(file_paths) do
    table.insert(items, source_item_from_file_path(file_path, edit_range))
  end

  return items
end

function Source.new(opts)
  local self = setmetatable({}, Source)
  self.opts = vim.tbl_deep_extend("force", default_opts, opts or {})

  return self
end

function Source:enabled()
  return vim.tbl_contains(self.opts.filetypes, vim.bo.filetype)
end

function Source:get_completions(context, callback)
  local prefix = source_context_prefix_get(context)

  if #prefix < self.opts.prefix_min_len then
    callback({ is_incomplete_backward = false, is_incomplete_forward = true, items = {} })
    return
  end

  local root = source_root_expand(self.opts.root)
  local now = vim.uv.now()
  local cached_file_paths = cache_file_paths_by_root[root]
  local edit_range = source_text_edit_range_get(context)

  if cached_file_paths and now - cache_time_by_root[root] < cache_ttl_ms then
    local items = source_items_from_file_paths(cached_file_paths, edit_range)
    callback({ is_incomplete_backward = true, is_incomplete_forward = true, items = items })
    return
  end

  local cmd = { "fd", "-e", "md", ".", root }
  for _, exclude_path in ipairs(self.opts.exclude_paths) do
    vim.list_extend(cmd, { "-E", exclude_path })
  end

  local fd = vim.system(cmd, {}, function(result)
    vim.schedule(function()
      if result.code ~= 0 then
        callback({ is_incomplete_backward = true, is_incomplete_forward = true, items = {} })
        return
      end

      local file_paths = {}
      for _, file_path in ipairs(vim.split(result.stdout, "\n")) do
        if file_path ~= "" then
          table.insert(file_paths, file_path)
        end
      end

      local items = source_items_from_file_paths(file_paths, edit_range)
      cache_file_paths_by_root[root] = file_paths
      cache_time_by_root[root] = vim.uv.now()

      callback({ is_incomplete_backward = true, is_incomplete_forward = true, items = items })
    end)
  end)

  return function()
    fd:kill(9)
  end
end

return Source
