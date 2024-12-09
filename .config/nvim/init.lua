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
require("plugins.luasnip")
require("plugins.markdown")
require("plugins.motions")
require("plugins.nvim-treesitter")
require("plugins.nvim-treesitter-textsubjects")
require("plugins.obsidian")
require("plugins.oil")
require("plugins.zmux")

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

require("local-highlight").setup({
  file_types = { "python", "cpp", "lua" },
  disable_file_types = { "tex" },
  hlgroup = "Search",
  cw_hlgroup = nil,
  insert_mode = false,
  min_match_len = 1,
  max_match_len = math.huge,
  highlight_single_match = true,
})

local plugins = {
  "coverage",
  "zen-mode",
  "react-extract",
  "sentiment",
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
  tint = -20,
  saturation = 0,
})

vim.cmd([[
" colorscheme rose-pine
colorscheme catppuccin-latte

let g:fugitive_gitlab_domains = ['https://gitlab.scm-emea.aws.fisv.cloud']
]])

require("bqf").setup({
  preview = {
    winblend = 0,
  },
})

if vim.env.TERM == 'xterm-kitty' then
  vim.cmd([[autocmd UIEnter * if v:event.chan ==# 0 | call chansend(v:stderr, "\x1b[>1u") | endif]])
  vim.cmd([[autocmd UILeave * if v:event.chan ==# 0 | call chansend(v:stderr, "\x1b[<1u") | endif]])
end
