require('dotenv-safe').load();
const express = require('express');
const request = require('request');
const path = require('path');
const app = express();
const Twit = require('twit');
const Axios = require('axios');
const port = process.env.PORT || 8081;

// initialize Twit
const T = new Twit({
  consumer_key: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  access_token: process.env.ACCESS_TOKEN,
  access_token_secret: process.env.ACCESS_TOKEN_SECRET,
});
const appUsername = '100Fourty';
let userStream = T.stream('user');
let mentionStream = T.stream('statuses/filter', {track:'100Fourty'});

// listen for connection
userStream.on('connect', function(request){
  console.log('using a user stream to listen for events specific to @' + appUsername);
});

// Listen for tweets that mention bot
mentionStream.on('connect', function(request){
  console.log('using a filter stream to listen for mentions');
})

// when 100Fourty is mentioned, lookup the venue and tweet back
mentionStream.on('tweet', (tweet) => {
    eventLookUp(tweet.text, tweet.user.screen_name);
})

function eventLookUp(content, ogUser){
  let username = ogUser;
  let venueId = '';
  let venueCalendar = {};
  let params = screenTweets(content);
  let searchBy = params.searchBy;
  let searchVal = params.searchVal;

    // 	get search criteria from the tweet
    // find *venue place* and split it into an array to get the venue name
  function screenTweets(tweet){
    let splitTweet = tweet.toLowerCase().match(/\*(.*?)\*/g)[0].replace(/\*+/g, '').split(' ');
    return {
      searchBy: splitTweet.shift(),
      searchVal: splitTweet.reduce(function(a, b){
        return a.concat(' ' + b);
      })
    };
  }

  // ueses other functions to search for the venue in Songkick's venues and get the info to tweet back to a user
  function getEvents(){
    Axios.get(`http://api.songkick.com/api/3.0/search/${searchBy}s.json?query=${searchVal}&apikey=${process.env.SONGKICK_KEY}&jsoncallback=`)
    .then(getVenueId)
    .then(getVenueCalendar)
    .catch(logAxiosErr);
  }

  // get the venue Id from the Songkick search results
  function getVenueId(response){
    let songkickRes = JSON.parse(response.data.slice([1], response.data.length - 2));
    venueId = songkickRes.resultsPage.results.venue[0].id;
    console.log('veueId: ' + venueId);
    return venueId;
  }

  // run another request to songkick to get the venue's data
  function getVenueCalendar(response){
    Axios.get(`http://api.songkick.com/api/3.0/venues/${response}/calendar.json?apikey=${process.env.SONGKICK_KEY}`)
    .then(getCalendarData)
    .then(processCalendarData)
    .then(respond)
    .catch(logAxiosErr);
  }

  // get the calendar from the venue
  function getCalendarData(response){
    venueCalendar = response.data;
    console.log('venueCalendar: ' + venueCalendar);
    return venueCalendar;
  }

  // get the day's show for the venue
  function processCalendarData(response){
    // get the first couple of shows to use in the reply, loop over them and get the info you need
    // for each item, check to see if the day/time of the tweet matches the current day/time
    let shows = response.resultsPage.results.event;
    let today = new Date();
    let month = ("0" + (today.getMonth() + 1)).slice(-2);
    let date = ("0" + today.getDate()).slice(-2);
    let showDay = `${today.getFullYear()}-${month}-${date}`
    let showsToday = shows.filter(function(show){
      if(show.start.date === showDay){
          return show;
        }
      }).map(function(show){
        return show.performace[0].displayName;
      });
    if(showsToday.length > 0){
      return showsToday;
    } else {
      return "i don't know. try another place?"
    }
  }


  // post a tweet with the day's show
  // get the initial user to reply to and pass that in with the show
  function respond(show){
    let params = {
      status: '@' + username + ' ' + show,
    };
    T.post('statuses/update', params, function(err, data, response){
          err ? console.log(err, response) : console.log(data.text);
    })
   return;
  }

  getEvents();

  /// end eventLookUp
}

function logAxiosErr(error){
  console.log(error);
}

app.listen(port, function () { console.log('App listening on port ' + port); });
