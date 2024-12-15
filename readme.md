# Ollama Server for Neuro Game SDK
Uses [ollama-js](https://github.com/ollama/ollama-js) to serve responses to [Neuro Game SDK](https://github.com/VedalAI/neuro-game-sdk).
The current purpose is to test the SDK, especially with non-forced actions. I can't guarantee that it will play your game correctly. I also can't guarantee that the behaviour mimics Neuro in any way!

## Requirements
* [**Ollama**](https://github.com/ollama/ollama) is required for this package to work. I recommend running a small model with a GPU for fast response times. Make sure that ollama is being served at the default port 11434 and that a model is running.
* A game that implements the Neuro Game SDK.
## Usage
1. Clone the repository or download from GitHub.
2. Configure the config in `src/config.ts`, especially change the model to the one that Ollama is serving. The default is `llama3.2`
3. Run `npm install`in the directory.
4. Run `npm run serve` 
5. Run the game!
## Games Tested
1. [Godot Tic Tac Toe](https://github.com/VedalAI/neuro-game-sdk)✅

There are likely many bugs and unexpected behaviours. If you have a Neuro game, please share and test. It would help with development, thanks.
