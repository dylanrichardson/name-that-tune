# Setup

Create a new Dialogflow agent at https://console.dialogflow.com/api-client/#/newAgent.
Then edit the agent and choose restore from zip using dialogflow.zip.
Go to the fulfillment section and change the url to point to <server_url>/intent (The server url/port must be publicly exposed).
Fill in .env with the Dialogflow access token. 

Create a Spotify App at https://beta.developer.spotify.com/dashboard/applications. Fill in .env with the client id and secret.

Create a Mongo database. Fill in .env with the mongo db url.

Fill in .env with a random string for the session secret.
