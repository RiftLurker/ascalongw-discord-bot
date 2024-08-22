# ascalongw-discord-bot

## Deploy

1. `docker build -t ascalongw .`
2. Windows: `docker run -d -v "%cd%\config.json":/app/config.json --name ascalongw ascalongw`
2. Linux: `docker run -d -v "$PWD/config.json":/app/config.json --name ascalongw ascalongw`

Make sure you've put your config into /config.json or the docker image won't run.

Optionally export port 80 for a HTTP ping endpoint