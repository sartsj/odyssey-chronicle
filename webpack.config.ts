import type { Configuration } from 'webpack';
import type { Configuration as DevServerConfiguration } from 'webpack-dev-server';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import path from 'path';

const isDev = process.env.NODE_ENV !== 'production';

const config: Configuration & { devServer?: DevServerConfiguration } = {
  mode: isDev ? 'development' : 'production',
  entry: './src/renderer.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'renderer.js',
    clean: true,
  },
  devtool: isDev ? 'inline-source-map' : false,
  devServer: {
    port: 1420,
    hot: true,
    static: './dist',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: { transpileOnly: true },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.svg$/,
        type: 'asset/inline',
      },
      {
        test: /\.json$/,
        type: 'json',
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
    }),
    new ForkTsCheckerWebpackPlugin({ logger: 'webpack-infrastructure' }),
  ],
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json'],
  },
};

export default config;
