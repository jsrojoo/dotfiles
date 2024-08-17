local M = {}

function map(mode, lhs, rhs, opts)
  local options = { noremap=true, silent=true }

  if opts then
    options = vim.tbl_extend('force', options, opts)
  end

  vim.api.nvim_set_keymap(mode, lhs, rhs, options)
end

local function modemap(mode, lhs, rhs, opts)
  return map(mode, lhs, rhs, opts)
end

local function nmap(lhs, rhs, opts)
  return modemap('n', lhs, rhs, opts)
end

local function tmap(lhs, rhs, opts)
  return modemap('t', lhs, rhs, opts)
end

local function tmapleader(lsh, rhs, opts)
  return tmap('<space>' .. lsh, rhs, opts)
end

local function nmapleader(lsh, rhs, opts)
  return nmap('<leader>' .. lsh, rhs, opts)
end

M.map = map
M.modemap = modemap
M.nmap = nmap
M.tmap = tmap
M.tmapleader = tmapleader
M.nmapleader = nmapleader

return M

