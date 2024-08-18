require('options')
require('keymaps')

require('plugins/completions')
require('plugins/formatter')
require('plugins/fuzzy-finder')
require('plugins/git')
require('plugins/lsp-config')
require('plugins/mason-lsp-installer')
require('plugins/python')
require('plugins/reactjs')
require('plugins/treesitter')

require "paq" {
  "savq/paq-nvim",
  "neovim/nvim-lspconfig",
  'maxmx03/solarized.nvim',
  "EdenEast/nightfox.nvim",
  "spywhere/tmux.nvim",
  "projekt0n/github-nvim-theme",
  'nmac427/guess-indent.nvim',
}

-- vim.o.background = 'light' -- or 'light'
vim.cmd.colorscheme 'github_light_default'

require('guess-indent').setup {}
