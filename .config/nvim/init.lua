-- Set leaders early so lazy.nvim and keymaps resolve <leader> correctly
vim.g.mapleader = " "
vim.g.maplocalleader = " "

vim.loader.enable()

require("core.options")
require("core.keymaps")
require("core.autocommands")

require("plugins.lazy")

require("plugins.nvim-cmp")

require("lsp.lspconfig")

require("plugins.firenvim")
require("plugins.fzf-lua")
require("plugins.gitsigns")
require("plugins.indent-blankline")
require("plugins.snippets")
require("plugins.markdown")
require("plugins.motions")
require("plugins.nvim-treesitter")
require("plugins.nvim-treesitter-textsubjects")
require("plugins.obsidian")
require("plugins.oil")
require("plugins.zmux")
require("plugins.copilot")

if vim.g.started_by_firenvim == false then
  require("plugins.image")
else
  vim.g.firenvim_config.localSettings['.*'] = {
    takeover = 'never',
    selector = 'textarea'
  }
end

require("plugins.image-clip")

-- plugins
require("nvim_comment").setup()
require("swagger-preview").setup({})

local plugins = {
  "coverage",
  "react-extract",
  "colorizer",
}

for _, plugin in ipairs(plugins) do
  local status_ok, plug = pcall(require, plugin)

  plug.setup({})
end

vim.api.nvim_create_user_command("RefactorReact", function(opts)
  local react_extract_ok, react_extract = pcall(require, "react-extract")
  react_extract.extract_to_current_file()
end, {})

require("tint").setup({
  tint = -30,
  saturation = 0.0,
})

vim.cmd([[
colorscheme warlock

let g:fugitive_gitlab_domains = ['https://gitlab.gbsemea-scm-gitlab.aws.fisv.cloud', 'https://gitlab.scm-emea.aws.fisv.cloud/EMEA/GBS/EGPT/applications/apis/document-intelligence-api.git']
]])

require("bqf").setup({
  preview = {
    winblend = 0,
  },
})

require("swagger-preview").setup({
    -- The port to run the preview server on
    port = 1232,
    -- The host to run the preview server on
    host = "localhost",
})

if vim.env.TERM == 'xterm-kitty' then
  vim.cmd([[autocmd UIEnter * if v:event.chan ==# 0 | call chansend(v:stderr, "\x1b[>1u") | endif]])
  vim.cmd([[autocmd UILeave * if v:event.chan ==# 0 | call chansend(v:stderr, "\x1b[<1u") | endif]])
end
