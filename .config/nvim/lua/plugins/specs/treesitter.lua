return {
  {
    "nvim-treesitter/nvim-treesitter",
    lazy = false,
    build = ":TSUpdate",
  },

  -- Show the current Treesitter context (e.g., function/class) at the top
  {
    "nvim-treesitter/nvim-treesitter-context",
    main = "treesitter-context",
    opts = {
      enable = true,
      max_lines = 3,            -- limit context lines shown
      trim_scope = "outer",     -- which scope to discard if too long
      mode = "cursor",          -- update context based on cursor position
      multiline_threshold = 20, -- max lines for a single context chunk
      min_window_height = 0,    -- 0 disables the check
      zindex = 20,
      on_attach = nil,          -- nil => enable for all filetypes
    },
    keys = {
      { "[c", function() require("treesitter-context").go_to_context() end, desc = "Go to Treesitter context" },
      { "<leader>tc", "<cmd>TSContext toggle<CR>", desc = "Toggle Treesitter Context" },
    },
  },
}
