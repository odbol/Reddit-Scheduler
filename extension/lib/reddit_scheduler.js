
/***

	Reddit Scheduler

	Schedules your posts on Reddit. 

	Requires:
		- Gnarwhal.js, a simple Javascript Reddit API wrapper.
		- Backbone.js

	by Tyler Freeman
	http://odbol.com
***/

// constants

// if true, does not actually submit posts to reddit, just fakes it.
var IS_DRY_RUN = false,
	SHOW_DESKTOP_NOTIFICATIONS = true;


var _api = null,
	// holds a global API that everyone uses.
	getApi = function () {
		if (!_api) {
			_api = new Gnarwhal();
		}

		return _api;
	},


	/***
		Post model. Holds the info to post, as well as status info.
	**/
	RedditPost = Backbone.Model.extend({
		initialize : function() {
			// this.set({isPosted: false});
			// this.set({postDate: false});
			// this.set({numRetries: 0});
		},

		destroy : function () {
			var alarmName = this.get('alarmName');

			if (alarmName) {
				chrome.alarms.clear(alarmName);
			}

			// call super
			Backbone.Model.prototype.destroy.apply(this, arguments);
		},

		parse : function (res, opts) {
			if (res.postDate && !res.postDate.isValid) { // check if it's a moment object or just a data string
				res.postDate = moment(res.postDate);
			}

			return res;
		}
	}),

	// private collection of all posts
	PostCollection = Backbone.Collection.extend({
		model: RedditPost,
		localStorage: new Backbone.LocalStorage("RSAllPosts"),

		// Filter down the list of all todo items that are finished.
		submitted: function() {
			return this.filter(function(post) {
				return post.get('isPosted'); 
			});
		},

		// Filter down the list to only todo items that are still not finished.
		pending: function() {
			return this.without.apply(this, this.submitted());
		},
	}),

	_AllPosts = new PostCollection(),


	/***
		The Reddit Base class. 

		Handles saving/login, just set username/pw and call postNew() to submit.

		Treat all calls as static and shared globally.

	**/
	RedditBase = function () {

	};

RedditBase.prototype =	{
		getAllPosts : function () {
			return _AllPosts;
		},

		getUsername : function() {
			return localStorage.getItem('RSUsername');
		},
		setUsername : function(username) {

			if (!username) {
				localStorage.removeItem('RSUsername');
			}
			else {
				localStorage.setItem('RSUsername', username);
			}
		},
		getPassword : function() {
			return localStorage.getItem('RSPassword');
		},
		setPassword : function(password) {

			if (!password) {
				localStorage.removeItem('RSPassword');
			}
			else {
				localStorage.setItem('RSPassword', password);
			}
		},
		logOut : function() {
			localStorage.removeItem('RSPassword');
			localStorage.removeItem('RSUsername');
		},


		/*** 
			Logs in with stored username/pass and submits a new post to reddit.

			postAttrs can be either a RedditPost model object, 
			or the initializing attributes for a RedditPost model object. e.g.:								
				{
					subreddit: ...
					title : ...
					url : ...
					text : ...
				}

			Returns a promise indicating status:
			done() receives the post, with updated info.
			fail() receives the error message.

		**/
		postNew : function (postAttrs) {
			var RS = this,
				// decide if they sent a model or just the seeds of one
				post = postAttrs.set ? postAttrs : new RedditPost(postAttrs),

				p = getApi(), 
				promise = new Deferred(),
				onLoggedIn = function () {
					var onFail = function (res) {
							post.set('numRetries', post.get('numRetries') + 1);

							promise.reject.apply(promise, arguments);
						},
						onSuccess = function (res) {
							post.set('postDate', moment());
							post.set('isPosted', true);
							post.set('redditUrl', res.json.data.url);

							post.save().done(function () {
								promise.resolve(post);	
							});
						};

					printDebug("logged in ", p.user());
					
					if (IS_DRY_RUN) {
						onSuccess({
							json : {
								data : {
									url: "Dry run only, not submitted to reddit"
								}
							}
						});
						return;
					}

					p.submit(
							post.get('subreddit'), 
							post.get('url'), 
							post.get('title'), 
							post.get('text'))
						.done(function (res) {

							if (res.json && res.json.data) {
								onSuccess.apply(this, arguments);
							}
							else {
								onFail.apply(this, arguments);
							}
						})
						.fail(onFail);
				};

			if (SHOW_DESKTOP_NOTIFICATIONS) {
				promise.always(onSubmittedShowNotification);
			}

			if (IS_DRY_RUN) {
				onLoggedIn();
			}
			else {
				p.login(RS.getUsername(), RS.getPassword())
					.done(onLoggedIn)
					.fail(promise.reject);
			}	

			return promise.promise();
		},
	

		checkUserName : function () {
			var RS = this;

			if (!RS.getUsername()) {
		      RS.setUsername(prompt("Enter reddit username"));
		      if (!RS.getUsername()) return false;
			}

			if (!RS.getPassword()) {
		      RS.setPassword(prompt("Enter password (saved locally)"));
		      if (!RS.getPassword()) return false;
		    }

		    return true;
		}
	};


/***
	The RedditScheduler, extending the normal RedditBase class. 

	Adds functionality for timed posts, otherwise works the same.

	Treat all calls as static and shared globally.

	Requires moment.js

**/
var RedditScheduler = function () {
		var self = this,

			/***
				This doesn't matter, just need to register with onAlarm so we don't get cleaned out.
			*/
			onAlarm = function (alarm) {
				console.log("Got alarm in background ", alarm);

				_AllPosts.fetch(function () {
	
				}); 
			},

			/***

				Response to a message from the RedditSchedulerClient
				
				request should be an object with a single key: the name of the method to call on RedditScheduler.
					The value should be an array of arguments to pass to that method.
			***/
			onMessage =  function(request, sender, sendResponse) {
				var func = _.keys(request)[0],
					args = request[func],

					promise = self[func].apply(self, args);

				if (sendResponse) {
					
					// call them back when the post is saved to the datastore so they can retreive it,
					// not when the post is actually made (which will be a while and beyond the life of the UI code)
					promise.progress(function (step) {

						if (step == 'saved') {
							sendResponse();
						}
					})
					.fail(sendResponse);
				}
			};

		chrome.alarms.onAlarm.addListener(onAlarm);
		chrome.runtime.onMessage.addListener(onMessage);
	},
	alarmId = 0;

RedditScheduler.prototype = _.extend(RedditScheduler.prototype, RedditBase.prototype, {
		setPostTimes : function(times) {

			localStorage.setItem('RSPostTimes', 
				JSON.stringify(times || this.getDefaultPostTimes()));
		},

		getDefaultPostTimes : function() {
			return [
				'1 minutes',
				'10 minutes',
				'1 hours',
				'3 hours',
				'10:14am',
				'1:06pm',
				'5:22pm',
				'9:08pm'
				];
		},  

		getPostTimes : function() {
			var times = JSON.parse(localStorage.getItem('RSPostTimes'));

			if (!times) {
				times = this.getDefaultPostTimes();
				this.setPostTimes(times);
			}

			// add contextual times

			// var relativeMinutes = [5, 10, 60, 200];
			// relativeMinutes.forEach(function (el, idx) {
			// 	times.push(moment().add('minutes', el).format('h:mma'));
			// });

			// times = times.sort();


			return times;
		},

		/*** 
			Logs in with stored username/pass and submits a new post to reddit at specified time.

			Arguments are the same as postNew(), except with the new postTime preceding all.

			postTime: a string from getPostTimes();

			Returns a promise indicating status, same as postNew().

		**/
		postDelayed : function (postTime, postAttrs) {
			var RS = this,
				// decide if they sent a model or just the seeds of one
				post = postAttrs.set ? postAttrs : new RedditPost(postAttrs),
				promise = new Deferred(),
				alarmInfo = RS.getAlarmInfo(postTime),
				alarmName = "rsalarm_" + alarmInfo.when,
				alarm = null;

			if (!alarmInfo) {
				promise.reject("Invalid time.");
			}
			else {
				if (chrome && chrome.alarms) {
					alarm = chrome.alarms.create(alarmName, alarmInfo);

					post.set('alarmName', alarmName);
					post.set('postDate', moment(alarmInfo.when));
					_AllPosts.add(post);

					post.save().done(function () {
						// we've saved, let the UI know that they can refresh from datastore now
						promise.notify('saved');

						// schedule it for later
						chrome.alarms.onAlarm.addListener(function (alarm) {
                            printDebug('Got alarm ', alarm);
                            
							if (alarm.name == alarmName) {
								RS.postNew(post)
									.done(promise.resolve)
									.fail(promise.reject);
							}
						});
					});
				}
				else {
					promise.reject("Alarms not supported. Are you using chrome?");
				}
			}

			return promise.promise();
		},

		/***
			Returns an alarmInfo object, suitable for passing to chrome.alarms.

			postTime is a string from getPostTimes()

		***/
		getAlarmInfo : function (postTime) {
			var todayStart = moment().startOf('day'),
				postDate = moment(todayStart.format('YYYY-MM-DD ') + postTime, 'YYYY-MM-DD h:mma');

			if (!postDate.isValid())
				postDate = this.parseRelativeTime(postTime);

			if (!postDate.isValid()) return null;

			// always schedule for the next day
			if (postDate.isBefore(moment())) {
				postDate.add('days', 1);
			}

			return {
					when : postDate.toDate().getTime()
				};
		},

		/***
			Parses a string like "10 minutes" into a relative time from now.
		*/
		parseRelativeTime : function  (postTime) {
			var parts = postTime.split(' '),
				newDate = moment().add(parts[1], parts[0]);

			return newDate;
		}
	});




/***
	A proxy client for the RedditScheduler. Sends all delayed posts to the background page of the extension,
	so alarms can exist beyond the life of the calling page.

	Use this in your popup.js and other content scripts.
	
***/
var RedditSchedulerClient = function () {

	};

RedditSchedulerClient.prototype = _.extend(RedditSchedulerClient.prototype, RedditScheduler.prototype, {

		/*** 
			Logs in with stored username/pass and submits a new post to reddit at specified time.

			Arguments are the same as postNew(), except with the new postTime preceding all.

			postTime: a string from getPostTimes();

			Returns an empty promise since we can't promise across boundries.

		**/
		postDelayed : function (postTime, post) {
			var promise = new Deferred();

			// always post to the background scheduler so it can keep track
			chrome.runtime.sendMessage({
					postDelayed : Array.prototype.slice.apply(arguments) 
					// [
					// 	postTime,
					// 	new RedditPost(postOpts)
					// ]
				},
				promise.resolve);

			return promise.promise();
		}

	});





var testBackboneLocal = function () {
	_AllPosts.fetch()
	// Object {state: function, always: function, then: function, promise: function, pipe: function…}
	_AllPosts.pending()
	// [
	// child
	// , 
	// child
	// , 
	// child
	// ]
	_AllPosts.submitted()
	// []
	var big = _AllPosts.pending()[0]
	// undefined
	big.set('isPosted', true)
	// child {cid: "c1", attributes: Object, collection: child, _changing: false, _previousAttributes: Object…}
	big.save().done(function (e) { console.log(e)});
	// Object {subreddit: "sdgf", title: "dasf", url: "TEST222222", text: "", isPosted: true…}
	// Object {state: function, always: function, then: function, promise: function, pipe: function…}
	_AllPosts.submitted()
	// [
	// child
	// ]
	_AllPosts.pending()
	// [
	// child
	// , 
	// child
	// ]
	_AllPosts.fetch({reset: true, success : function () {console.log.apply(console, arguments)}});
	// Object {state: function, always: function, then: function, promise: function, pipe: function…}
	_AllPosts.pending()
	// [
	// child
	// , 
	// child
	// , 
	// child
	// ]
	_AllPosts.submitted()
	// []

	// WTFFFFFF ^^^^^
};
