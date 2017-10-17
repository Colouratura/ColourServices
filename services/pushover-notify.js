/**
 * Pushover-Notify
 *
 * This script allows one to set a process to watch for newly created pages
 * on a wiki. When one is found it is subsequently recorded and a desktop
 * notification dispatched to notify the user.
 *
 * Author: Colouratura
 */

const fs      = require('fs');
const request = require('request');


const RATE_LIMIT  = 30000;
const CONFIG_FILE = __dirname + '/../data/pushover-config.json';
const CACHE_FILE  = __dirname + '/../data/pushover-cache.json';

const CONFIG = require(CONFIG_FILE);

/**
 * fetch the last recorded new page
 *
 * This function reads the temp file and attempts to convert it from JSON
 * to a valid JavaScript Object which contains a title and a timestamp
 * property.
 *
 * @return {Promise}
 */
const readLast = async function () {
	return new Promise(function (resolve, reject) {
		fs.readFile(CACHE_FILE, 'utf-8', function (err, data) {
			if (err)
				resolve({
					title: '',
					timestamp: new Date(null)
				});

			try {
				let last = JSON.parse(data);
				last.timestamp = new Date(last.timestamp);

				resolve(last);
			} catch (e) {
				resolve({
					title: '',
					timestamp: new Date(null)
				});
			}
		});
	});
};

/**
 * save the last recorded new page
 *
 * This function takes an object and then attemps to save it to a file
 * which can then be read back again at a later date.
 *
 * @param {string} info
 * @return {Promise}
 */
const saveLast = async (info) => {
	return new Promise(function (resolve, reject) {
		let data = JSON.stringify(info);

		fs.writeFile(CACHE_FILE, data, 'utf-8', function (err) {
			if (err) reject(err);
			else resolve();
		});
	});
};

/**
 * serialize object
 *
 * When given key value map of query paramters this function serializes them
 * into a valid query string.
 *
 * @param {object} obj
 */
const serialize = function (obj) {
	return (
		'?' +
		Object.keys(obj)
			.reduce(function (array, key) {
				array.push(key + '=' + encodeURIComponent(obj[key]));
				return array;
			}, [])
			.join('&')
	);
};

/**
 * creates a desktop notification
 *
 * @param {object} last
 */
const notify = function (last) {
	let uri = 'https://api.pushover.net/1/messages.json',
	    params = {
	    	token:     CONFIG.tokens.app,
		user:      CONFIG.tokens.user,
		title:     'New Page',
		message:   last.title + ' has been created!',
		url:       `http://${CONFIG.wiki}.wikia.com/wiki/${encodeURIComponent(last.title)}?useskin=oasis`,
		url_title: last.title
	    },
	    url = uri + serialize(params);

	request.post(url, function (err, res, body) {});
};

/**
 * fetched a list of new pages
 *
 * This function contacts the MediaWiki API to fetch a JSON formatted list of
 * newly created pages.
 *
 * @return {Promise}
 */
const fetchPages = async function () {
	return new Promise(function (resolve, reject) {
		let wiki = `http://${CONFIG.wiki}.wikia.com/api.php`,
		    params = {
			action:      'query',
			list:        'recentchanges',
			rctype:      'new',
			rcprop:      'timestamp|title|ids|user',
			rclimit:     '10',
			rcnamespace: '0',
			format:      'json'
		    },
		    queryString = wiki + serialize(params);

		request.get(queryString, function (err, res, body) {
			if (err) reject(err);

			try {
				let data = JSON.parse(body);

				resolve(data.query.recentchanges);
			} catch (e) {
				reject(e);
			}
		});
	});
};

/**
 * finds the newest page
 *
 * When given a list of pages from the API this function finds the newest one
 * and yields it.
 *
 * @param {array[object]} pages
 * @param {object} last
 * @return {Promise}
 */
const processPages = async function (pages, last) {
	return new Promise(function (resolve, reject) {
		let newest = {
			title:     last.title,
			timestamp: last.timestamp
		};

		pages.forEach(function (page) {
			page.timestamp = new Date(page.timestamp);

			if (page.timestamp > newest.timestamp) {
				newest.title     = page.title;
				newest.timestamp = page.timestamp;
			}
		});

		if (last.title !== newest.title) resolve(newest);
		else reject();
	});
};

/**
 * Entry point
 */
const main = async function () {
	try {
		let last  = await readLast(),
		    pages = await fetchPages(),
		    next  = await processPages(pages, last);

		notify(next);
		saveLast(next);
	} catch (e) {}
};

(async function() {
	main();
	setInterval(main, CONFIG.interval);
})();
