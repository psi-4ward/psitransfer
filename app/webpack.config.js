const path = require('path');
const webpack = require('webpack');
const execSync = require('child_process').execSync;

let commitShaId;

try {
  commitShaId = '#'+execSync('git rev-parse HEAD').toString().substr(0,10);
} catch (e) {}

module.exports = {
  entry: {
    upload: './src/upload.js',
    download: './src/download.js',
    admin: './src/admin.js',
  },
  output: {
    path: path.resolve(__dirname, '../public/app'),
    publicPath: '/app/',
    filename: '[name].js'
  },
  plugins: [
    new webpack.optimize.CommonsChunkPlugin({
      filename: "common.js",
      name: "common"
    }),
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: process.env.NODE_ENV !== 'development' ? '"production"' : '"development"',
      },
      PSITRANSFER_VERSION: '"' + (process.env.PSITRANSFER_VERSION || commitShaId || 'dev') + '"'
    }),
  ],
  module: {
    rules: [
      {
        test: /\.vue$/,
        loader: 'vue-loader',
        options: {
          loaders: {}
        }
      },
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/
      },
      {
        test: /\.(png|jpg|gif|svg)$/,
        loader: 'file-loader',
        options: {
          name: '[name].[ext]?[hash]'
        }
      }
    ]
  },
  resolve: {
    alias: {
      'vue$': 'vue/dist/vue.common.js'
    }
  },
  devServer: {
    historyApiFallback: true,
    noInfo: true,
    proxy: [
      // Proxy requests to BE in DEV mode
      // https://webpack.github.io/docs/webpack-dev-server.html#proxy
      {
        context: ['/**'],
        target: 'http://localhost:3000/'
      }
    ]
  },
  performance: {
    hints: false
  },
  devtool: '#eval-source-map'
};

if (process.env.NODE_ENV !== 'development') {
  module.exports.devtool = '#source-map';
  let commit;

  // http://vue-loader.vuejs.org/en/workflow/production.html
  module.exports.plugins = [
    ...module.exports.plugins,
    new webpack.optimize.UglifyJsPlugin({
      sourceMap: true,
      compress: {
        warnings: false
      }
    }),
    new webpack.LoaderOptionsPlugin({
      minimize: true
    })
  ];
}
