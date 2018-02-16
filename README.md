# Demo

https://name-the-tune.herokuapp.com/

# Setup

Create a new Dialogflow agent at https://console.dialogflow.com/api-client/#/newAgent.
Then edit the agent and choose restore from zip using dialogflow.zip.
Go to the fulfillment section and change the url to point to <server_url>/intent (The server url/port must be publicly exposed).
Get the Dialogflow Client access token from the agent settings page.
Add the line DIALOGFLOW_ACCESS_TOKEN=<token> to the .env.

Create a Spotify App at https://beta.developer.spotify.com/dashboard/applications.
Edit the settings and add <server_url>/connect to the list of redirect URIs.
Get the client id and the secret from the app settings page.
Add the line SPOTIFY_CLIENT_ID=<client_id> to the .env.
Add the line SPOTIFY_CLIENT_SECRET=<client_secret> to the .env.

Create a Mongo database. Add the line MONGODB_URI=<uri> to the .env.

Generate a random string for the session secret.
Add the line SESSION_SECRET=<secret> to the .env.

Optionally, add PORT=<port> to the .env.
