var express = require("express"),
	session = require("express-session"),
	passport = require("passport"),
	MediaWikiStrategy = require("passport-mediawiki-oauth").OAuthStrategy,
	series = require("async-series"),
	async = require('async'),
	app = express(),
	router = express.Router(),
	path = require('path');
const http = require('http');
var mongoose = require('mongoose');
let ejs = require('ejs');
const PopupTools = require('popup-tools');
const utils = require('./utils');

var config = require('../config');
const OAuth = require('oauth-1.0a');
const wikiUpload = require('../models/wikiUploadUtils');
const User = require('../models/User');
const baseUrl = 'https://commons.wikimedia.org/w/api.php';

app.set("views", __dirname + "/public/views");
app.set("view engine", "ejs");

const fs = require('fs');
const Path = require('path');
const Listr = require('listr');
const Axios = require('axios');
const shell = require('shelljs');
const { exec } = require('child_process');
const BASE_URL = 'https://commons.wikimedia.org/w/api.php';

const oauth = OAuth({
	consumer: {
		key: config.consumer_key,
		secret: config.consumer_secret,
	},
})

app.use('/routes', express.static(__dirname + '/routes'));

app.use(passport.initialize());
app.use(passport.session());
app.use(session({
	secret: "OAuth Session",
	saveUninitialized: true,
	resave: true
}));

// mongoose.connect('localhost:4000/video-cut-tool-back-end', function (err) {

//    if (err) throw err;

//    console.log('Successfully connected');

// });

// passport.use(
// 	new MediaWikiStrategy({
// 		consumerKey: config.consumer_key,
// 		consumerSecret: config.consumer_secret
// 	},
// 	function ( token, tokenSecret, profile, done ) {
// 		profile.oauth = {
// 			consumer_key: config.consumer_key,
// 			consumer_secret: config.consumer_secret,
// 			token: token,
// 			token_secret: tokenSecret
// 		};
// 		const userProfile = {
// 			...profile,
// 			oauth: {
// 				token: token,
// 				token_secret: tokenSecret
// 			}
// 		}
// 		return done( null, userProfile );
// 	}
// 	) );

passport.serializeUser(function (user, done) {
	done(null, user);
});

passport.deserializeUser(function (obj, done) {
	done(null, obj);
});
/* GET home page. */
router.get('/video-cut-tool-back-end', function (req, res, next) {
	res.render('index', {
		title: 'VideoCutTool',
		user: req && req.session && req.session.user,
		url: req.baseUrl
	});
});

router.post('/video-cut-tool-back-end/send', function (req, res, next) {
	console.log('Hit Send')
	const disableAudio = req.body.disableAudio;
	var out_width = req.body.out_width;
	var out_height = req.body.out_height;
	var x_value = req.body.x_value;
	var y_value = req.body.y_value;
	const url = req.body.inputVideoUrl;
	var mode = req.body.trimMode;
	var trims = req.body.trims;
	const trimVideo = req.body.trimVideo;
	var user = req.body.user;
	let videoExtension = url.split('.').pop().toLowerCase();
	let videoName = `video_${Date.now()}_${parseInt(Math.random() * 10000)}`
	var videoPath = Path.join(__dirname, '/videos/', videoName + '.' + videoExtension);
	var videoSettings;
	var upload = true;
	var title = req.body.title;

	// Video Settings
	var rotateVideo = req.body.rotateVideo;
	var trimIntoMultipleVideos = req.body.trimIntoMultipleVideos;
	var trimIntoSingleVideo = req.body.trimIntoSingleVideo;
	var cropVideo = req.body.cropVideo;
	var upload = req.body.upload;

	// I'm justing changing RotateValue here and assigning to 1 as for now the 
	// the video should rotate only 90 degreee clock wise
	let RotateValue = 1;

	console.log("Your Video Mode is : " + mode);
	console.log("Your video upload to commons is : " + upload);
	console.log("You Video Audio Disablity is : " + disableAudio);
	console.log("Video Rotation : " + rotateVideo);
	console.log("Video Crop : " + cropVideo);
	console.log("Video trim into multiple videos : " + trimIntoMultipleVideos);
	console.log("Video trim in to single video : " + trimIntoSingleVideo);
	console.log("New video Title : " + title)

	console.log('downloading video')
	utils.downloadVideo(url, (err, videoPath) => {
		if (err || !videoPath || !fs.existsSync(videoPath)) {
			console.log(err)
			return res.status(400).send('Error downloading video');
		}
		const processFuncArray = [];
		// Initialize video path with the downloaded path

		if (trimVideo) {
			processFuncArray.push((cb) => {
				console.log('trimming')
				utils.trimVideos(videoPath, trims, mode, (err, videosLocation) => {
					utils.deleteFiles([videoPath]);
					if (err) return cb(err);
					return cb(null, videosLocation);
				})
			})
		} else {
			// Just map to an array of paths
			processFuncArray.push((cb) => {
				setTimeout(() => {
					return cb(null, [videoPath]);
				}, 100);
			})
		}
		if (rotateVideo) {
			processFuncArray.push((videoPaths, cb) => {
				utils.rotateVideos(videoPaths, RotateValue, (err, rotatedVideos) => {
					utils.deleteFiles(videoPaths);
					if (err) return cb(err);
					return cb(null, rotatedVideos);
				})
			})
		}
		if (cropVideo) {
			processFuncArray.push((videoPaths, cb) => {
				console.log('cropping')
				utils.cropVideos(videoPaths, out_width, out_height, x_value, y_value, (err, croppedPaths) => {
					utils.deleteFiles(videoPaths);
					if (err) return cb(err);
					return cb(null, croppedPaths)
				})
			})
		}
		if (mode === "single" && trims.length > 1) {
			processFuncArray.push((videoPaths, cb) => {
				utils.concatVideos(videoPaths, (err, concatedPath) => {
					utils.deleteFiles(videoPaths);
					if (err) return cb(err);
					return cb(null, [concatedPath]);
				})
			})
		}
		if (disableAudio) {
			processFuncArray.push((videoPaths, cb) => {
				console.log('remove audio')
				utils.removeAudioFromVideos(videoPaths, (err, clearedPaths) => {
					utils.deleteFiles(videoPaths);
					if (err) return cb(err);
					return cb(null, clearedPaths);
				})
			})
		}
		console.log('starting processing')
		async.waterfall(processFuncArray, (err, result) => {
			console.log(err, result)
			console.log('=================== result ==================');
			utils.moveVideosToPublic(result, (err, newPaths) => {
				if (err) return res.status(400).send('something went wrong');
				return res.json({ videos: newPaths.map((p) => p.split('public/').pop())});
			})
			// if (!upload || result.length > 1) {
			// 	return res.json({ videos: result });
			// }
			// wikiUpload.uploadFileToMediawiki(
			// 	user.mediawikiToken,
			// 	user.mediawikiSecret,
			// 	// fs.createWriteStream('rotate/' + RotatedvideoName + '.' + videoExtension),
			// 	fs.createReadStream(result[0]),
			// 	{
			// 		filename: title,
			// 		// text: 'New Text'
			// 	},
			// 	(err, response) => {
			// 		if (err) {
			// 			console.log(err);
			// 			return res.status(400).send('Something went wrong while uploading the video')
			// 		}
			// 		res.send(response);
			// 	}
			// )
		})
	})
});

router.get('/insert', function (req, res, next) {
	res.render('index', {
		message: "Trimming success"
	});
});

router.get("/video-cut-tool-back-end/login", function (req, res) {
	res.redirect(req.baseUrl + "/auth/mediawiki");
});

router.get("/", function (req, res) {
	res.redirect(req.baseUrl + '/video-cut-tool-back-end/');
});


router.get('/auth/mediawiki', passport.authenticate("mediawiki"), () => {

});

router.get('/video-cut-tool-back-end/auth/mediawiki/callback', passport.authenticate('mediawiki', {
	failureRedirect: '/login',
}), (req, res) => {
	const user = JSON.parse(JSON.stringify(req.user));

	res.end(PopupTools.popupResponse({ user }));

})

router.get('/auth/mediawiki/callback', passport.authenticate('mediawiki', {
	failureRedirect: '/login',
}), (req, res) => {
	const user = JSON.parse(JSON.stringify(req.user));

	res.end(PopupTools.popupResponse({ user }));

})

module.exports = router;