
/***

	Reddit Scheduler

	Schedules your posts on Reddit. 

	Includes simple Javascript Reddit API wrapper

	Requires jQuery 1.6+, and being on the reddit.com page.

	by Tyler Freeman
	http://odbol.com
***/

// constants
var REDDIT_BASE_URL = 'http://www.reddit.com';

var Deferred = $.Deferred,
	printError = function () {
		console.log.apply(console, arguments);
	},
	RedditScheduler = function () {
		/*** PRIVATE MEMBERS ***/
		// holds the current promise, which we chain the next request to. 
		// finish it so they first thing they do is executed immediately
		var _curTask = new Deferred().resolve(),
			makeRequest = function(method, origArguments) {
				var promise = new Deferred();

				if (origArguments && origArguments.length > 0) {
					// use full url
					origArguments[0] = REDDIT_BASE_URL + origArguments[0];

					// add api type to post vars which is required for all
					if (origArguments.length > 1) {
						origArguments[1].api_type = 'json';
					}
				}

				_curTask.done(function () {
					// make sure they always chain off the last request
					_curTask = $[method].apply($, origArguments)
						.done(promise.resolve)
						.fail(function (err) {
							printError("Request to Reddit failed.", err);
							promise.reject(err);
						});
				});
				
				return promise.promise();
			},

			// holds the user object
			_user = {};

		// makes a request to reddit
		this.get = function () {
			return makeRequest('getJSON', arguments);
		};
		this.post = function () {
			return makeRequest('post', arguments);
		};

		/** Sets or returns the logged-in user object **/
		this.user = function (userObj) {
			if (userObj) {
				_user = userObj;
			}

			return _user;
		};

	};

RedditScheduler.prototype.login = function(user, pass) {
	var self = this,
		promise = new Deferred();

	self.post('/api/login', {
			user: user, 
			passwd: pass
		})
		.done(function (loginRes) {

			self.get('/api/me.json')
				.done(function (res) { 
					// console.log(res);

					// save the user and especially their modhash for submitting
					self.user(res.data);
					promise.resolve();
				})
				.fail(promise.reject);
		})
		.fail(promise.reject);

	return promise.promise();
};

/**

Posts to the specified subreddit. Must login() first.

text is optional. If included, the post will be a self post 

**/
RedditScheduler.prototype.submit = function(subreddit, url, title, text) {
	if (title.length > 300) return new Deferred().reject("Title too long.").promise();

	var self = this,
		promise = new Deferred();

	self.get('/api/needs_captcha.json')
		.done(function (res) {
			if (res == 'true') {
				promise.reject("Could not post. Needs captcha. Human, come save me!");

				return;
			}

			self.post('/api/submit', {
					sr : subreddit,
					url : url,
					title : title,
					text : text,
					kind : text || !url ? 'self' : 'link',
					//extension : 'json',
					uh : self.user().modhash
				})
				.done(promise.resolve)
				.fail(promise.reject);
		})
		.fail(promise.reject);

	return promise.promise();
};



var getUsername = function() {
		return localStorage.getItem('RSUsername');
	},
	setUsername = function(username) {
		localStorage.setItem('RSUsername', username);
	},
	getPassword = function() {
		return localStorage.getItem('RSPassword');
	},
	setPassword = function(password) {
		localStorage.setItem('RSPassword', password);
	},
	logOut = function() {
		localStorage.removeItem('RSPassword');
		localStorage.removeItem('RSUsername');
	},

	/*** 
		Logs in and submits a new post to reddit.

		Returns a promise indicating status.

	**/
	postNew = function () {
		var origArguments = arguments,
			p = new RedditScheduler(), 
			promise = new Deferred();

		p.login(getUsername(), getPassword())
			.done(function () {
				printError("logged in ", p.user());
				
				p.submit.apply(p, origArguments)
					.done(promise.resolve)
					.fail(promise.reject);
			})
			.fail(promise.reject);
		
		return promise.promise();
	},

	test = function () {
		if (!getUsername()){
			setUsername(prompt("Enter reddit username"));
			setPassword(prompt("Enter password (saved locally)"));
		}

		postNew('sfmusic', 'http://www.indiegogo.com/projects/the-doomlaut-album', 
				"Anyone recorded at Studio SQ? My band is planning to record there and could use some tips");

		postNew('gadgets', 'http://www.youtube.com/watch?v=8BJwaEixC9M', 'DrumPants: An Entire Band in your Pocket') 
	};
