### @100Fourty

A small app to automate a twitter account, done just for fun.  This 'bot' replies back to mentions with the day's headline show at a given concert venue provided in the tweet aimed at it.  

It's not deployed yet, but feel free to clone/download the repo, and see how it works by doing this:

* Get keys and credentials from Twitter and Songkick.  Check out .env.example for what you need.
* Replace @100Fourty in the code with your account's handle.
* install dependencies listed in package.json
* Use "npm/yarn run dev" from the cli to get things running.    

To get replies back from the bot to see who's playing at your favorite place, mention your account's handle in a tweet and wrap *'s around the word 'venue' and the actual venue name, like this:

* Hey, @twitterName *venue 9:30 Club *


Tools used include:

* Node/Express
* Songkick API for concert information
* Axios for requests to Songkick
* Twit library for the Twitter API.
