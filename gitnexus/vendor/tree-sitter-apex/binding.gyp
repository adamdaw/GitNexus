{
  "targets": [
    {
      "target_name": "tree_sitter_apex_binding",
      "dependencies": [ "<!(node -p \"require('node-addon-api').targets\"):node_addon_api_except" ],
      "include_dirs": [ "src" ],
      "sources": [ "src/parser.c", "bindings/node/binding.cc" ],
      "cflags_c": [ "-std=c11" ],
      "variables": { "openssl_fips": "" }
    }
  ]
}
