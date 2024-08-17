require('options')
require('keymaps')

require('plugins/mason-lsp-installer')
require('plugins/lsp-config')
require('plugins/completions')
require('plugins/python')
require('plugins/git')

require "paq" {
    "savq/paq-nvim",
    "neovim/nvim-lspconfig",

    "EdenEast/nightfox.nvim",

    "spywhere/tmux.nvim",
}

vim.cmd([[
colorscheme nordfox
]])



