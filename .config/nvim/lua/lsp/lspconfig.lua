-----------------------------------------------------------
-- Neovim LSP configuration file
-----------------------------------------------------------
-- Migrate away from deprecated require('lspconfig') to vim.lsp.config/vim.lsp.enable
-- See :help lspconfig-nvim-0.11

local mason_ok, mason = pcall(require, "mason")

if not mason_ok then
  return
end

local mason_lspconfig_ok, mason_lspconfig = pcall(require, "mason-lspconfig")

if not mason_lspconfig_ok then
  return
end

local cmp_nvim_lsp_ok, cmp_nvim_lsp = pcall(require, "cmp_nvim_lsp")

if not cmp_nvim_lsp_ok then
  return
end

local cmp_capabilities = cmp_nvim_lsp.default_capabilities()

local on_attach = function(client, bufnr)
  if client.server_capabilities.documentHighlightProvider then
    vim.api.nvim_create_augroup("lsp_document_highlight", { clear = true })
    vim.api.nvim_clear_autocmds({ buffer = bufnr, group = "lsp_document_highlight" })
  end

  local bufopts = { noremap = true, silent = true, buffer = bufnr }

  vim.keymap.set("n", "gD", vim.lsp.buf.declaration, bufopts)
  vim.keymap.set("n", "gd", vim.lsp.buf.definition, bufopts)
  vim.keymap.set("n", "K", vim.lsp.buf.hover, bufopts)
  vim.keymap.set("n", "gi", vim.lsp.buf.implementation, bufopts)
  vim.keymap.set("n", "<C-k>", vim.lsp.buf.signature_help, bufopts)
  vim.keymap.set("n", "<leader>D", vim.lsp.buf.type_definition, bufopts)
  vim.keymap.set("n", "<leader>rn", vim.lsp.buf.rename, bufopts)
  vim.keymap.set("n", "<leader>ca", vim.lsp.buf.code_action, bufopts)
  vim.keymap.set("n", "gr", vim.lsp.buf.references, bufopts)
  vim.keymap.set("n", "<leader>fe", function()
    vim.lsp.buf.format({ async = true })
  end, bufopts)
end

vim.diagnostic.config({
  virtual_text = false,
  update_in_insert = true,
  current_line_virtual_text = true,
  float = {
    focusable = false,
    style = "minimal",
    border = "rounded",
    source = 'if_many',
    header = "",
    prefix = "",
  },
})

local root_dir = function()
  return vim.fn.getcwd()
end

local servers = {
  "bashls",
  "cssls",
  "docker_compose_language_service",
  "dockerls",
  "eslint",
  "marksman",
  "pyright",
  "quick_lint_js",
  "ruff",
  -- "sqls",
  "vimls",
  "yamlls",
  "lemminx",
  -- "ts_ls",
  -- "vale_ls",
}

mason.setup()
mason_lspconfig.setup({
  automatic_enable = {
    -- "sqls",
    -- "dockerls",
    -- "docker_compose_language_service",
    -- "marksman",
    -- "pyright",
    -- "ruff",
    -- "yamlls",
    -- "lua_ls",
    -- "vimls",
    -- "lemminx",
  },
})

for _, lsp in ipairs(servers) do
  -- Configure defaults for each server, then enable filetype-based activation
  vim.lsp.config(lsp, {
    on_attach = on_attach,
    root_dir = root_dir,
    capabilities = cmp_capabilities,
  })
  vim.lsp.enable(lsp)
end

-- lua_ls has extra settings; configure separately and enable
vim.lsp.config('lua_ls', {
  on_attach = on_attach,
  root_dir = root_dir,
  capabilities = cmp_capabilities,
  settings = {
    Lua = {
      runtime = {
        version = "LuaJIT",
      },
      diagnostics = {
        globals = {
          "vim",
          "require",
        },
        disable = { "missing-fields" },
      },
      workspace = {
        checkThirdParty = false,
        -- Make the server aware of Neovim runtime files
        library = vim.api.nvim_get_runtime_file("", true),
      },
      -- Do not send telemetry data containing a randomized but unique identifier
      telemetry = {
        enable = false,
      },
    },
  },
})
vim.lsp.enable('lua_ls')


vim.lsp.handlers["textDocument/hover"] = function(err, result, ctx, config)
  -- If no documentation was returned, do nothing.
  if err or not (result and result.contents) then
    return
  end

  -- Convert the hover contents from the LSP into markdown lines.
  local markdown_lines = vim.lsp.util.convert_input_to_markdown_lines(result.contents)
  markdown_lines = vim.lsp.util.trim_empty_lines(markdown_lines)
  if vim.tbl_isempty(markdown_lines) then
    return
  end

  -- Option 1: Open a new vertical split window, create a new buffer, and set its content.
  -- You can change 'vsplit' to 'split' for a horizontal split if you prefer.
  vim.cmd("split")
  local buf = vim.api.nvim_create_buf(false, true)  -- create a new unlisted buffer
  vim.api.nvim_win_set_buf(0, buf)  -- place our new buffer in the current window

  -- Set the buffer’s contents to the hover markdown.
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, markdown_lines)

  -- Optionally, set the filetype to markdown for proper syntax highlighting.
  vim.api.nvim_buf_set_option(buf, "filetype", "markdown")

  -- You might also want to disable editing on this buffer:
  vim.api.nvim_buf_set_option(buf, "modifiable", false)
end
