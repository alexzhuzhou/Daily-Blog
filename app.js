
// Importing the libraries
require("dotenv").config()
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const express = require("express");
const methodOverride = require("method-override");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const findOrCreate = require('mongoose-findorcreate');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
// Load the full build.
var _ = require('lodash');
//Setting Up database
const mongoose = require("mongoose");



const app = express();
app.use(express.static("public")); 

app.use(methodOverride('_method'));

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));



app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());


mongoose.connect(process.env.MONGODB_URI);

const userSchema = new mongoose.Schema({
  email: String,
  username: String,
  password: String,
  googleId: String,
  secret: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model("User", userSchema);
passport.use(User.createStrategy());

passport.serializeUser((user, done) => {
    done(null, user.id);
});
passport.deserializeUser((id, done) => {
    User.findById(id)
        .then((user) => {
            done(null, user);
        });
});
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/secrets",
    },
    function (accessToken, refreshToken, profile, cb) {
      // Extract the email and displayName
      const email = profile.emails[0].value; // Get the email
      const username = profile.displayName; // Get the display name

      // Find or create the user in the database
      User.findOrCreate(
        { googleId: profile.id }, // Match by Google ID
        { email: email, username: username }, // Save email and username if creating a new user
        function (err, user) {
          return cb(err, user);
        }
      );
    }
  )
);

// create collection Schema
const postSchema = new mongoose.Schema({
  title : String,
  content: String,
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
});

const Post = mongoose.model("Post", postSchema);


app.get("/", function(req,res) {
  res.render("main");
});

app.get("/auth/google",  
  passport.authenticate("google",{scope:["profile", "email"]}));

app.get("/auth/google/secrets",
  passport.authenticate("google", {failureRedirect: "/login"}),
  function(req,res) {
      res.redirect("/home");
  });



app.get("/login", function(req,res) {
  res.render("login");
});

app.get("/register", function(req,res) {
  res.render("register");
});


app.post("/register", function(req,res) {
  User.register(new User({username: req.body.username, email: req.body.email}), req.body.password, function(err, user) {
    if(err) {
      console.log(err);
      res.redirect("/register");
    }
    else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("/home");
      });
    }
  });
});

app.post("/login", function(req,res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function(err) {
    if(err) {
      console.log(err);
    }
    else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("/home");
      });
    }
  });
});


app.get("/home", function(req, res) {
  if (req.isAuthenticated()) {
    Post.find()
      .then((posts) => {
        if (posts.length === 0) {
          res.render("home" ,{posts:[]})
        }
        else {
          res.render("home", {posts:posts});
        }

      })
      .catch((err) => {
        console.log(err);
      });
  }
  else {
    res.redirect("/login");
  }
});

app.get("/about", function(req, res) {
  res.render("about");
});

app.get("/contact", function(req, res) {
  res.render("contact");
});

app.get("/compose", function(req, res) {
  if (req.isAuthenticated()) {  
    res.render("compose");
  }
  else {
    res.redirect("/login");
  }
});

app.post("/compose", function(req, res) {
  if(req.isAuthenticated()) {
    const post = new Post({ 
      title: req.body.postTitle,
      content: req.body.postBody,
      author: req.user
    });
  
    post.save();
    res.redirect("/home");

  }
  else {
    res.redirect("/login");
  }

});



app.route("/posts/:postName")
  .get(function(req,res) {
    let postTitle = req.params.postName;

    Post.findOne({title: postTitle})
      .then((post) => {
        if(post) {
          User.findById(post.author)
            .then((user) => {
              res.render("post", {title:post.title, body:post.content, author: user.username});
            })
            .catch((err) => {
              console.log(err);
            });
        }
        else {
          res.redirect("/home");
        }
      })
      .catch((err) => {
        console.log(err);
      })
  })
  .put(function(req, res) {
    let postTitle = req.params.postName;
    Post.findOneAndUpdate(
      { title: postTitle },
      { title: req.body.postTitle, content: req.body.postBody , author: req.user },
      { new: true }
    )
      .then((updatedPost) => {
        User.findById(updatedPost.author)
          .then((user) => { 
            res.render("post", { title: updatedPost.title, body: updatedPost.content, author: user.username });
          }) 
          .catch((err) => {
            console.log(err);
          });
      });

  })
  .delete(function(req, res) {
    let postTitle = req.params.postName;
    Post.findOneAndDelete({ title: postTitle })
      .then(() => {
        res.redirect("/home");
      })
      .catch((err) => {
        console.log(err);
      });
    });

app.get("/logout", function(req,res) {
  req.logout(function() {
    res.redirect("/");
  }); 
});


app.listen(process.env.PORT);


