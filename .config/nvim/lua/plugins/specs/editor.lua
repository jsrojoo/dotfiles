return {
  "terrortylor/nvim-comment",
  "lewis6991/gitsigns.nvim",

  -- utilities
  "t9md/vim-smalls",
  "tpope/vim-fugitive",
  "tpope/vim-repeat",
  "tpope/vim-surround",
  "wellle/targets.vim",
  "dhruvasagar/vim-table-mode",

  {
    "windwp/nvim-autopairs",
    event = "InsertEnter",
    opts = {},
  },

  {
    "windwp/nvim-ts-autotag",
    opts = {},
  },

  {
    "glacambre/firenvim",
    build = function()
      vim.fn["firenvim#install"](0)
    end,
  },

  "levouh/tint.nvim",

  { "kevinhwang91/nvim-bqf" },

  {
    "stevearc/quicker.nvim",
    opts = {},
  },

  "jbyuki/venn.nvim",

  {
    "ariel-frischer/bmessages.nvim",
    opts = {},
  },
}
