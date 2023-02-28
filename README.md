
<p align=\"center\">
  <img alt=\"CLI demo\" src=\"./demos/cli.gif\">
</p>

## Updates
<details open>
<summary><strong>2023-10-14</strong></summary>
This repo has been forked from [hotrainy/node-chatgpt-api](https://github.com/hotrainy/node-chatgpt-api) for active maintenance.

</details>

# AI-GPT-Refiner

> An advanced client implementation for ChatGPT and Bing AI, available as a Node.js module, REST API server, and CLI app.

[![NPM](https://img.shields.io/npm/v/@hotrainy/chatgpt-refiner.svg)](https://www.npmjs.com/package/@hotrainy/ai-gpt-refiner)
[![npm](https://img.shields.io/npm/dt/@hotrainy/chatgpt-refiner)](https://www.npmjs.com/package/@hotrainy/ai-gpt-refiner)
[![MIT License](https://img.shields.io/badge/license-MIT-blue)](https://github.com/hotrainy/node-chatgpt-api/blob/main/LICENSE)
[![GitHub Repo stars](https://img.shields.io/github/stars/hotrainy/node-chatgpt-api)](https://github.com/hotrainy/node-chatgpt-api/)

# Table of Contents
   * [Features](#features)
   * [Getting Started](#getting-started)
      * [Prerequisites](#prerequisites)
      * [Usage](#usage)
         * [Module](#module)
         * [API Server](#api-server)
         * [CLI](#cli)
      * [Using a Reverse Proxy](#using-a-reverse-proxy)
   * [Projects](#projects)
   * [Web Client](#web-client)
   * [Caveats](#caveats)
   * [Contributing](#contributing)
   * [License](#license)

## Features
- Includes an API server (with Docker support) you can run to use ChatGPT in non-Node.js applications.
- Includes a CLI interface where you can chat with ChatGPT.
- Includes clients that you can use in your own Node.js applications.
- `ChatGPTClient`: support for the official ChatGPT underlying model, `gpt-3.5-turbo`, via OpenAI's API.
  - Retains support for models like `text-davinci-003`