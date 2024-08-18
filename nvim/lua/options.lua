-----------------------------------------------------------
-- General Neovim settings and configuration
-----------------------------------------------------------

-- Default options are not included
-- See: https://neovim.io/doc/user/vim_diff.html
-- [2] Defaults - *nvim-defaults*

local g = vim.g       -- Global variables
local opt = vim.opt   -- Set options (global/buffer/windows-scoped)

local home = os.getenv('HOME') -- Home directory

g.python_host_prog = home .. '/.config/nvim/nvim-venv/bin/python3'
g.python3_host_prog = home .. '/.config/nvim/nvim-venv/bin/python3'
-----------------------------------------------------------
-- General
-----------------------------------------------------------
opt.clipboard = 'unnamedplus'         -- Copy/paste to system clipbo ard
opt.completeopt = 'menuone,noinsert,noselect'  -- Autocomplete options
opt.mouse = 'a'                       -- Enable mouse support
opt.swapfile = false                  -- Don't use swapfile

-----------------------------------------------------------
-- Neovim UI
-----------------------------------------------------------
opt.colorcolumn = '80'      -- Line length marker at 80 columns
opt.foldmethod = 'marker'   -- Enable folding (default 'foldmarker')
opt.ignorecase = true       -- Ignore case letters when search
opt.laststatus = 3          -- Set global statusline
opt.linebreak = true        -- Wrap on word boundary
opt.number = true           -- Show line number
opt.relativenumber = true   -- Show relative line numbers
opt.scrolloff = 999
opt.showmatch = true        -- Highlight matching parenthesis
opt.signcolumn = 'yes:1'
opt.smartcase = true        -- Ignore lowercase for the whole pattern
opt.splitbelow = true       -- Horizontal split to the bottom
opt.splitright = true       -- Vertical split to the right
opt.termguicolors = true    -- Enable 24-bit RGB colors
opt.textwidth = 75
opt.wrap = false

-----------------------------------------------------------
-- Tabs, indent
-----------------------------------------------------------
opt.expandtab = true        -- Use spaces instead of tabs
opt.shiftwidth = 2          -- Shift 2 spaces when tab
opt.smartindent = true      -- Autoindent new lines
opt.softtabstop = 2         -- 1 tab == 2 spaces
opt.tabstop = 2             -- 1 tab == 2 spaces

-----------------------------------------------------------
-- Memory, CPU
-----------------------------------------------------------
opt.hidden = true           -- Enable background buffers
opt.history = 100           -- Remember N lines in history
opt.lazyredraw = true       -- Faster scrolling
opt.synmaxcol = 240         -- Max column for syntax highlight
opt.updatetime = 250        -- ms to wait for trigger an event

-----------------------------------------------------------
-- Startup
-----------------------------------------------------------
-- Disable nvim intro
opt.shortmess:append "sI"

-- -- Disable builtin plugins
local disabled_built_ins = {
   "2html_plugin",
   "bugreport",
   "compiler",
   "ftplugin",
   "getscript",
   "getscriptPlugin",
   "gzip",
   "logipat",
   "matchit",
   "netrw",
   "netrwFileHandlers",
   "netrwPlugin",
   "netrwSettings",
   "optwin",
   "rplugin",
   "rrhelper",
   "spellfile_plugin",
   "synmenu",
   "tar",
   "tarPlugin",
   "tutor",
   "vimball",
   "vimballPlugin",
   "zip",
   "zipPlugin",
}

for _, plugin in pairs(disabled_built_ins) do
   g["loaded_" .. plugin] = 1
end

