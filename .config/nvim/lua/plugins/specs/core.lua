return {
  "https://github.com/hardselius/warlock",

  {
    "NStefan002/screenkey.nvim",
    lazy = false,
    version = "*", -- or branch = "dev", to use the latest commit
  },

  -- {
  --   "catgoose/nvim-colorizer.lua",
  --   opts = {},
  -- },

  {
    "williamboman/mason.nvim",
    lazy = false,
    opts = {},
  },

  -- Indent line
  {
    "lukas-reineke/indent-blankline.nvim",
    main = "ibl",
    opts = {},
  },

  -- Indent python
  "Vimjas/vim-python-pep8-indent",

  "ibhagwan/fzf-lua",
  "nanotee/zoxide.vim",
}
