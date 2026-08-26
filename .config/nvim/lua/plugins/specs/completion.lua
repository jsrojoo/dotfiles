local function blink_item_obsidian_create_is(item)
  local command = item.command

  return command and command.command == "obsidian.write_note"
end

local function blink_wikilink_context_is()
  local cursor_col = vim.api.nvim_win_get_cursor(0)[2]
  local line_before_cursor = vim.api.nvim_get_current_line():sub(1, cursor_col)

  return line_before_cursor:find("%[%[[^%]]*$") ~= nil
end

local function blink_wikilink_context_not_is()
  return not blink_wikilink_context_is()
end

local function blink_path_cwd_default_get(context)
  return vim.fn.expand(("#%d:p:h"):format(context.bufnr))
end

local function blink_path_editor_temp_is(file_path)
  local codex_editor_temp_is = file_path:match("/%.codex/editor/%.tmp[^/]*%.md$") ~= nil
  local zsh_editor_temp_is = file_path:match("^/private/tmp/zsh[^/]*%.zsh$") ~= nil

  return codex_editor_temp_is or zsh_editor_temp_is
end

local function blink_path_cwd_get(context)
  local file_path = vim.api.nvim_buf_get_name(context.bufnr)

  if blink_path_editor_temp_is(file_path) then
    return vim.fn.getcwd()
  end

  return blink_path_cwd_default_get(context)
end

return {
  {
    "saghen/blink.cmp",
    version = "1.*",
    opts = {
      completion = {
        menu = {
          auto_show = false,
          min_width = 1,
          draw = {
            columns = { { "label" } },
            gap = 0,
            padding = 0,
            components = {
              label = {
                ellipsis = false,
                width = { fill = false, max = 15 },
              },
            },
          },
        },
      },
      fuzzy = {
        sorts = {
          function(a, b)
            local a_create = blink_item_obsidian_create_is(a)
            local b_create = blink_item_obsidian_create_is(b)

            if a_create ~= b_create then
              return not a_create
            end
          end,
          "score",
          "sort_text",
        },
      },
      keymap = {
        preset = "super-tab",
        ["<C-n>"] = {
          function(cmp)
            if cmp.is_menu_visible() then
              return cmp.select_next()
            end

            return cmp.show({ initial_selected_item_idx = 1 })
          end,
        },
        ["<C-p>"] = {
          function(cmp)
            if cmp.is_menu_visible() then
              return cmp.select_prev()
            end

            return cmp.show({ initial_selected_item_idx = -1 })
          end,
        },
      },
      snippets = {
        preset = "luasnip",
      },
      sources = {
        default = { "lsp", "path", "snippets", "buffer" },
        per_filetype = {
          markdown = { "wiki_links", "lsp", "path", "snippets", "buffer" },
        },
        providers = {
          buffer = {
            enabled = blink_wikilink_context_not_is,
          },
          path = {
            enabled = blink_wikilink_context_not_is,
            opts = {
              get_cwd = blink_path_cwd_get,
            },
          },
          snippets = {
            enabled = blink_wikilink_context_not_is,
          },
          wiki_links = {
            enabled = blink_wikilink_context_is,
            module = "plugins.completion.wiki_links",
            name = "WikiLinks",
            opts = {
              prefix_min_len = 3,
              root = "~/Documents/work-notes",
            },
            score_offset = 85,
          },
        },
      },
    },
  },

  "L3MON4D3/LuaSnip",
  "rafamadriz/friendly-snippets",
}
