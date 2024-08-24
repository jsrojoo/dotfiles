vim.cmd([[
  au BufEnter github.com_*.txt set filetype=markdown
  au BufEnter reddit.com_*.txt set filetype=markdown

  let g:firenvim_config = {
    \ "globalSettings": { "alt": "all", },
    \ "localSettings": {
      \ ".*": {
      \ "cmdline": "neovim",
      \ "content": "text",
      \ "priority": 0,
      \ "selector": "textarea",
      \ "takeover": "always",
    \ },
   \ }
  \ }

  let fc = g:firenvim_config["localSettings"]
  let fc[".*"] = { "takeover": "never", "priority": 1 }
]])
