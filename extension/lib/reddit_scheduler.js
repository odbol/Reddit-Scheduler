
/***

	Reddit Scheduler

	Schedules your posts on Reddit. 

	Requires Gnarwhal.js, a simple Javascript Reddit API wrapper.

	by Tyler Freeman
	http://odbol.com
***/


var _api = null,
	// holds a global API that everyone uses.
	getApi = function () {
		if (!_api) {
			_api = new Gnarwhal();
		}

		return _api;
	},

	/***
		The main RedditScheduler class. 

		Handles saving/login, just set username/pw and call postNew() to submit.

		All calls are static and shared globally.

	**/
	RedditScheduler = {
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
			Logs in and submits a new post to reddit.

			Returns a promise indicating status.

		**/
		postNew : function () {
			var RS = RedditScheduler;

			var origArguments = arguments,
				p = getApi(), 
				promise = new Deferred();

			p.login(RS.getUsername(), RS.getPassword())
				.done(function () {
					printDebug("logged in ", p.user());
					
					p.submit.apply(p, origArguments)
						.done(promise.resolve)
						.fail(promise.reject);
				})
				.fail(promise.reject);
			
			return promise.promise();
		},

		checkUserName : function () {
			var RS = RedditScheduler;

			if (!RS.getUsername()) {
		      RS.setUsername(prompt("Enter reddit username"));
		      if (!RS.getUsername()) return false;
			}

			if (!RS.getPassword()) {
		      RS.setPassword(prompt("Enter password (saved locally)"));
		      if (!RS.getPassword()) return false;
		    }

		    return true;
		},

		test : function () {
			var RS = RedditScheduler;

			RS.checkUserName();

			RS.postNew('sfmusic', 'http://www.indiegogo.com/projects/the-doomlaut-album', 
					"Anyone recorded at Studio SQ? My band is planning to record there and could use some tips");

			RS.postNew('gadgets', 'http://www.youtube.com/watch?v=8BJwaEixC9M', 'DrumPants: An Entire Band in your Pocket');
		}
	};
