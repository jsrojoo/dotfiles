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
          },
          snippets = {
            enabled = blink_wikilink_context_not_is,
          },
          wiki_links = {
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
