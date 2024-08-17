require('options')
require('keymaps')

require('plugins/mason-lsp-installer')
require('plugins/lsp-config')
require('plugins/completions')
require('plugins/python')
require('plugins/git')
require('plugins/fuzzy-finder')

require "paq" {
    "savq/paq-nvim",
    "neovim/nvim-lspconfig",
    'maxmx03/solarized.nvim',
    "EdenEast/nightfox.nvim",
    "spywhere/tmux.nvim",
}

vim.o.background = 'light' -- or 'light'
vim.cmd.colorscheme 'solarized'
