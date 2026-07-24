require("obsidian").setup({
  legacy_commands = false,
  ui = {
    enable = false,
    -- checkboxes = {
    --   [" "] = { char = "󰄱", hl_group = "ObsidianTodo" },
    --   ["x"] = { char = "", hl_group = "ObsidianDone" },
    -- },
  },
  file = {
    ignore_filters = {
      "%.git/",
      "%.obsidian/",
      "media/",
    },
  },
  note_id_func = function(title)
    return title or 'Untitled'
  end,
  workspaces = {
    {
      name = "work",
      path = "~/Documents/work-notes/",
    },
  },
  templates = {
    folder = "templates",
    date_format = "%Y-%m-%d",
    time_format = "%H:%M",
    -- A map for custom variables, the key should be the variable and the value a function
    substitutions = {
      today = function()
        return os.date("%Y-%m-%d")
      end,
      yesterday = function()
        return os.date("%Y-%m-%d", os.time() - 86400)
      end,
      standup_yesterday = function()
        local _yesterday = os.date("%Y-%m-%d", os.time() - 86400)

        return _yesterday .. "#" .. _yesterday
      end
    },
  },
  daily_notes = {
    -- Optional, if you keep daily notes in a separate directory.
    folder = "Daily Notes",
    -- Optional, if you want to change the date format for the ID of daily notes.
    date_format = "%Y-%m-%d",
    -- Optional, if you want to change the date format of the default alias of daily notes.
    alias_format = "%B %-d, %Y",
    -- Optional, default tags to add to each new daily note created.
    default_tags = { "daily-notes" },
    -- Optional, if you want to automatically insert a template from your template directory like 'daily.md'
    template = "daily.md",
  },
  picker = {
    name = "fzf-lua",
  },
  link = {
    style = "wiki",
  },
  completion = {
    min_chars = 3,
  },
  footer = {
    enabled = false, -- turn it off
    separator = false, -- turn it off
  },
  -- follow_url_func = function(url)
  --   vim.fn.jobstart({ "open", url })
  -- end,
  -- attachments = {
  --   img_folder = "media"
  -- }
})
