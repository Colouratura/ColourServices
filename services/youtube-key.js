const express = require('express');
const app     = express();

const CONFIG_FILE = __dirname + '/../data/youtube-key.json';
const CONFIG      = require(CONFIG_FILE);

app.enable('trust proxy');

app.get('/youtube_api_key', function (req, res) {
	res.setHeader('Access-Control-Allow-Origin', '*');
	
	if (CONFIG.trusted.includes(req.connection.remoteAddress))
		res.send(CONFIG.key);
	else
		res.send(CONFIG.reject);
});

const server = app.listen(CONFIG.port, function () {
	const host = server.address().address,
	      port = server.address().port;
});
