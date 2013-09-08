
/***

	Gnarwhal.js

	A simple Reddit API for jQuery.

	Everything is based on promises; I will keep mine if you keep yours,
	and hopefully we'll both avoid the Gnarwal's single horn of scorn.

	Requires jQuery 1.6+, and being on the reddit.com page.

	by Tyler Freeman
	http://odbol.com
***/

// constants
var REDDIT_BASE_URL = 'http://www.reddit.com';

var Deferred = $.Deferred,
	printDebug = function () {
		console.log.apply(console, arguments);
	},
	Gnarwhal = function () {
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
							printDebug("Request to Reddit failed.", err);
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

/***
	Logs in and saves the user for later actions.
**/
Gnarwhal.prototype.login = function(user, pass) {
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

text is optional. If included, or if url is missing, the post will be a self post.

**/
Gnarwhal.prototype.submit = function(subreddit, url, title, text) {
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

