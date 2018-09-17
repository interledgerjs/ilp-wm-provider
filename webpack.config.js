'use strict'
const webpack = require('webpack')

module.exports = {
  mode: 'development',

  entry: {
    'handler': './src/handler.js',
    'polyfill': './src/polyfill.js'
  },

  output: {
    filename: 'dist/[name].js',
    path: __dirname,
    libraryTarget: 'umd'
  },

  externals: {
    'ws': 'WsPolyfill',
    'url': 'UrlPolyfill'
  },

  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        options: {
          presets: ['es2017', 'es2015'],
          plugins: [['transform-runtime', {
            helpers: false,
            polyfill: false,
            regenerator: true, }]
          ]
        }
      }
    ]
  },

  node: {
    console: true,
    fs: 'empty',
    net: 'empty',
    tls: 'empty'
  }
}
