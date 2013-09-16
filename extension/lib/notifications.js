var notificationIcon = 'icon_large.png',

  notificationTemplate = {
    type: "basic",
    title: "Reddit Scheduled Post",
    message: "Derp",
    iconUrl: notificationIcon
  },

  notificationIdx = 0,

  urlsOfNotifications = {},

  creationCallback = function (notificationId) {
    console.log('Created notification ' + notificationId);
  },


  showMessage = function (msg, url) {
      var nId = "RSnotification" + notificationIdx++;

      if (chrome && chrome.notifications) {
        notificationTemplate.message = msg + url;

        // save for later if they click on it
        if (url) {
			urlsOfNotifications[nId] = url;
        }

        chrome.notifications.create(nId, notificationTemplate, creationCallback);
      }
  },

  /***

	Call this with RedditScheduler.postNew().always(onSubmittedShowNotification)
	to show desktop notifications.
  ***/
  onSubmittedShowNotification = function (post) {
    var url = '', 
        msg;  

    if (post.get) { // it is the post model object! success!
      url = post.get('redditUrl') || '';
      msg = 'Successfully posted ';
    }
    else {
      // if we just got a simiple error message, show it.
      msg = 'Failed to post ' + typeof(post) == 'String' ? post : '';
    }

    showMessage(msg, url);
  },



  // handles clicks on the notification
  onNotificationClick = function (notificationId) {
  	var url = urlsOfNotifications[notificationId];

  	if (url) {
  		chrome.tabs.create({active: true, url: url});
  	}
  };


chrome && chrome.notifications && 
	chrome.notifications.onClicked.addListener(onNotificationClick);

