vim.cmd([[
  function OpenMarkdownPreview (url)
    execute "silent ! open " . a:url
  endfunction
  
  let g:mkdp_browserfunc = 'OpenMarkdownPreview'
]])
