require('dotenv-safe').load();
const express = require('express');
const request = require('request');
const path = require('path');
const app = express();
const Twit = require('twit');
const Axios = require('axios');
const util = require('util');
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
  console.log(content);
  let username = ogUser;
  let venueId = '';
  let venueCalendar = {};
  let params = screenTweets(content);
  let searchBy = params.searchBy;
  let searchVal = params.searchVal;
  let somethingWrong = '@' + username + ' ' + 'No registered shows tonight (or something went wrong!)';

    // 	get search criteria from the tweet
    // find *venue place* and split it into an array to get the venue name
  function screenTweets(tweet){
    let splitTweet = tweet.toLowerCase().match(/\*(.*?)\*/g);
    if(splitTweet){
      let paramVals = splitTweet[0].replace(/\*+/g, '').split(' ');
      return {
        searchBy: paramVals.shift(),
        searchVal: paramVals.reduce(function(a, b){
          return a.concat(' ' + b);
        })
      };
    } else {
      return{
        searchBy: null,
        searchVal: null
      }
    }

  }

  // ueses other functions to search for the venue in Songkick's venues and get the info to tweet back to a user
  function getEvents(){
    if(searchBy){
      Axios.get(`http://api.songkick.com/api/3.0/search/${searchBy}s.json?query=${searchVal}&apikey=${process.env.SONGKICK_KEY}&jsoncallback=`)
      .then(getVenueId)
      .then(getVenueCalendar)
      .catch(logAxiosErr);
    } else {
      respond();
    }

  }

  // get the venue Id from the Songkick search results
  function getVenueId(response){
    let songkickRes = JSON.parse(response.data.slice([1], response.data.length - 2));
    let venueData = songkickRes.resultsPage.results;
    if(venueData.venue){
      venueId = venueData.venue[0].id;
      console.log('veueId: ' + venueId);
      return venueId;
    } else {
      respond();
    }

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
    if(shows != undefined){
      let today = new Date();
      let month = ("0" + (today.getMonth() + 1)).slice(-2);
      let date = ("0" + today.getDate()).slice(-2);
      let showDay = `${today.getFullYear()}-${month}-${date}`
      let showsToday = shows.filter(function(show){
        if(show.start.date === showDay){
            return show;
          }
        }).map(function(show){
          if(show){
            return show.displayName;
          }
        });
      if(showsToday.length > 0){
        console.log('shows today: ' + showsToday);
        return showsToday;
      } else {
        return null;
      }
    } else {
      console.log('error in processCalendarData');
      return null;
    }
  }

  // post a tweet with the day's show
  // get the initial user to reply to and pass that in with the show
  // search to see if reply was already posted
  // if it was, delete that tweet, then respond with message.
  // if no tweet is found, still respond with the message
  function respond(show){
    let lastErrId = '';
    // if the venue has a show, reply with message containing show name
    if(show != null){
     let message = '@' + username + ' ' + show;
     checkThenPost(message);
   } else {
    //  if there is no show or something went wrong, reply with error message
     let message = somethingWrong;
     checkThenPost(message);
   }
   return;
  }

  function postReply(replyMessage){
    let params = { status: replyMessage };
    T.post('statuses/update', params, function(err, data, response){
          err ? console.log('err at postReply()', err, data) : console.log('tweeted: ' + data.text);
    })
  }

  function checkThenPost(replyMessage){
    let params = { q: replyMessage };
    // search for the duplicated tweet
    T.get('search/tweets', params, function(err, data, response){
      if(err){
        console.log('err at status search: ', err);
        postReply(replyMessage)
      } else{
        // if it exists, delete it then respond, it it doesn't still respond
        if(data.statuses.length > 0){
          let foundTweetId = data.statuses[0].id_str;
          deleteAndPostReply(foundTweetId);
        } else {
          postReply(replyMessage);
        }
      }
    })
  }

  function deleteAndPostReply(tweetId){
    // if it exists, delete it then respond, it it doesn't still respond
    T.post('statuses/destroy/:id', { id: tweetId }, function (err, data, response) {
        console.log('deleted tweet: ', data.text);
        if(err){
          console.log(err);
        } else{
          postReply(data.text)
        }
    })
  }

  getEvents();
  /// end eventLookUp
}

function logAxiosErr(error){
  console.log(error);
}

app.listen(port, function () { console.log('App listening on port ' + port); });
