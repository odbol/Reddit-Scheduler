/***

  Reddit Scheduler Chrome Extension UI

  Schedules your posts on Reddit. 

  Requires Gnarwhal.js, a simple Javascript Reddit API wrapper.

  by Tyler Freeman
  http://odbol.com
***/


var
  scheduler = new RedditSchedulerClient(),


  onSubmit = function () {
    scheduler.checkUserName();

    var postOpts = {
          subreddit : $('input[name=subreddit]').val(),
          title : $('input[name=title]').val(),
          url : $('input[name=url]').val(),
          text : $('textarea[name=text]').val()
        },
        postTime = $('#postTime option:selected').val();

    scheduler.postDelayed(postTime, postOpts)
      .always(function () {
        // reload with the new posts
        // this doesn't seem to work
        scheduler.getAllPosts().fetch();

        // actually, fuck it, just close the window.
        // it's too hard to get chrome to sync up localStorages between threads
        window.close();
      });

    // clear all fields
    $('input, textarea').val('');

    return false;
  },


  /*** VIEWS ***/
  SubmittedPosts = Backbone.View.extend({
          getPosts : function () {
            return this.collection.submitted();
          },

          //model: App,

          events: {
            'click .delete': 'onClickDelete',
            'click .edit': 'onClickEdit'
          },

          initialize : function () {
            _.bindAll(this, 'render', 'getPosts'); // fixes loss of context for 'this' within methods

            this.collection.on('add', this.render, this);
            this.collection.on('remove', this.render, this);
            this.collection.on('reset', this.render, this);
            this.collection.on('change:isPosted', this.render);
          },

          // this would be nice, but chrome doesn't allow eval() so underscore's templating is worthless
          //template: _.template('<li><%= postDate %>: <a href="<%- redditUrl %>"><%- title %></a></li>'),
          template: function () {
            // must load once, AFTER dom is loaded
            if (!this._template) {
              this._template = Mustache.compile($('#templatePost').text());
            }

            return this._template.apply(this, arguments); 
          },

          render: function() {
            var self = this,
                html = '';

            this.$el.empty();

            this.getPosts().forEach(function (post, idx, arr) {
              var postDate = post.attributes.postDate,
                  html = self.template(_.extend({
                            prettyDate : postDate && postDate.calendar() || '',
                            url : '#'
                          }, 
                          post.attributes));

                $(html).appendTo(self.$el)
                  .data('post', post);
            });
            
            return this;
          },

          onClickDelete : function (ev) {
            var post = $(ev.target).parents('.post').data('post');

            if (post) {
              //if (confirm('Really delete ' + post.get('title') + "?")) {
                post.destroy();
              //}
            }
          },

          onClickEdit : function (ev) {
            var post = $(ev.target).parents('.post').data('post');

            if (post) {
              $('input[name=subreddit]').val(post.get('subreddit'));
              $('input[name=title]').val(post.get('title'));
              $('input[name=url]').val(post.get('url'));
              $('textarea[name=text]').val(post.get('text'));

              // they'll just have to start over
              // but only if the post hasn't been submitted yet
              if (!post.get('isPosted')) {
                post.destroy();
              }
            }
          }

  }),

  PendingPosts = SubmittedPosts.extend({
        getPosts : function () {
          return this.collection.pending();
        }
  });


document.addEventListener('DOMContentLoaded', function () {
  var postTimes = scheduler.getPostTimes(),
      allPosts = scheduler.getAllPosts(),

      submittedView = new SubmittedPosts({
        collection : allPosts,
        el : $('#submitted')
      }),

      pendingView = new PendingPosts({
        collection : allPosts,
        el : $('#pending')
      });


    // make links actually clickable
    $('body').on('click', 'a', function () {
      var url = this.href;

      if (url && url.length > 5 && /^http/.test(url)) { // don't open empty anchor links or links to the chrome-extension://
        chrome.tabs.create({url: url, active: true});
      }

      return false;
    });


  $('#postTime').empty();
  postTimes.forEach(function (el, index, array) {
    $('#postTime').append('<option value="' + el + '">' + el + '</option>');
  });



  $('.submit').click(onSubmit);

  $('.logout').click(function () {
    scheduler.logOut();

    return false;
  });


  // load everything from local storage!
  allPosts.fetch();
});
