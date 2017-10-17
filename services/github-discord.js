/**
 * GitHub-Discord
 * 	A better view at what Wikia is doing through the lense of Discord
 * 
 * This script allows you to poll the repository events for Wikia and then push them through
 * to discord.
 * 
 * Author: Colouratura
 */

const request = require('request');
const fs      = require('fs');

// Cache file and config file
const CACHE_FILE  = __dirname + '/../data/github-cache.json';
const CONFIG_FILE = __dirname + '/../data/github-config.json';
const CONFIG      = require(CONFIG_FILE);

// Delay
const RUNTIME_DELAY = CONFIG.interval;

// User-Agent
const USER_AGENT = 'khatch (0.0.1) http://dabpenguin.com';

// Wikia/app config
const REPO_ORG   = CONFIG.repo.org;
const REPO_NAME  = CONFIG.repo.repo;
const REPO_ID    = `${REPO_ORG}/${REPO_NAME}`;
const WIKIA_REPO = `https://api.github.com/repos/${REPO_ID}/events`;

// Discord webhook config
const DISCORD_WEBHOOK_ID    = CONFIG.webhook.id;
const DISCORD_WEBHOOK_TOKEN = CONFIG.webhook.token;
const DISCORD_WEBHOOK_COMB  = `${DISCORD_WEBHOOK_ID}/${DISCORD_WEBHOOK_TOKEN}`;
const DISCORD_WEBHOOK_URL   = `https://discordapp.com/api/webhooks/${DISCORD_WEBHOOK_COMB}`;

// Embed template
const DISCORD_GITHUB_EMBED_TEXT = '{user} {verb} "{title}" - <{link}>';
const DISCORD_GITHUB_EMBED = {
	content: undefined,
	tts:     false
};

/**
 * render_template
 * 
 * renders a template string with the pre-defined values
 * 
 * @param {string} template       - the template string to render
 * @param {object<key, val>} data - the template object to render from
 * 
 * @return {string}
 */
const render_template = function (template, data) {
	for (var key in data) {
		template = template.replace(
			new RegExp('\\{' + key + '\\}', 'g'),
			(data[key] !== null)
				? data[key]
				: ''
		);
	}

	return template;
};

/**
 * read_last
 * 
 * fetch the last recorded pull event
 *
 * @return {Promise}
 */
const read_last = async function () {
	return new Promise(function (resolve, reject) {
		fs.readFile(CACHE_FILE, 'utf-8', function (err, data) {
			if (err)
				resolve({
					id:        0,
					timestamp: new Date(null)
				});

			try {
				let last = JSON.parse(data);
				    last.timestamp = new Date(last.timestamp);

				resolve(last);
			} catch (e) {
				resolve({
					id:        0,
					timestamp: new Date(null)
				});
			}
		});
	});
};

/**
 * save_last
 * 
 * save the last recorded pull event
 *
 * @param {number<int>} id        - id of the last pull event
 * @param {Date}        timestamp - timestamp of the last pull event
 * 
 * @return {Promise}
 */
const save_last = async function (id, timestamp) {
	return new Promise(function (resolve, reject) {
		let data = JSON.stringify({
			id:        id,
			timestamp: timestamp
		});

		fs.writeFile(CACHE_FILE, data, 'utf-8', function (err) {
			if (err) reject(err);
			else resolve();
		});
	});
};

/**
 * post_to_channel
 * 
 * Posts a change to the discord channel via webhook
 * 
 * @param {string} p_title  - title of the pull request 
 * @param {string} p_url    - url of the pull request
 * @param {string} p_user   - user name of the person taking the action
 * @param {string} p_action - action being taken
 * 
 * @return {null}
 */
const post_to_channel = function ({title, url, user, action}) {
	let t_data = {
		user:  user,
		verb:  action,
		title: title,
		link:  url
	},
	r_template = render_template(DISCORD_GITHUB_EMBED_TEXT, t_data),
	embed      = Object.assign({}, DISCORD_GITHUB_EMBED);

	embed.content = r_template;
	//embed = JSON.stringify(embed);

	request.post(DISCORD_WEBHOOK_URL, (err, res, body) => {})
	       .form(embed);
};

/**
 * post_actions
 * 
 * Posts several changes to the discord channel via webhook
 * 
 * @param {array<object>} actions - action objects to post
 * 
 * @return {null}
 */
const post_actions = function (actions) {
	for (let i = 0; i < actions.length; i++) {
		post_to_channel(actions[i]);
	}
};

/**
 * fetch_actions
 * 
 * Fetches a list of recent repo actions
 *
 * @return {Promise}
 */
const fetch_actions = async function () {
	return new Promise(function (resolve, reject) {
		let options = {
			url: WIKIA_REPO + `?cb=${new Date().getTime()}`,
			headers: {
				'User-Agent': USER_AGENT
			}
		};

		request.get(options, function (err, res, body) {
			if (err) reject(err);

			try {
				let data = JSON.parse(body);

				resolve(data);
			} catch (e) {
				reject(e);
			}
		});
	});
};

/**
 * filter_actions
 * 
 * Only grab the pull request actions
 * 
 * @param {array<object>} actions 
 */
const filter_actions = function (actions) {
	let n_actions = [];

	for (let i = 0; i < actions.length; i++) {
		if (actions[i].type === 'PullRequestEvent') {
			n_actions.push({
				id:        actions[i].id,
				user:      actions[i].actor.display_login,
				title:     actions[i].payload.pull_request.title,
				action:    actions[i].payload.action,
				url:       actions[i].payload.pull_request.issue_url,
				timestamp: new Date(actions[i].payload.pull_request.updated_at)
			});
		}
	}

	return n_actions;
};

/**
 * strip_last
 * 
 * strips everything but the newest actions
 * 
 * @param {array<object>}    actions - list of actions to filter 
 * @param {object<key, val>} last    - action to filter by
 * 
 * @return {array<object>}
 */
const strip_last = function (actions, last) {
	let n_actions = [];

	for (let i = 0; i < actions.length; i++) {
		if (actions[i].timestamp > last.timestamp) {
			n_actions.push(Object.assign({}, actions[i]));
		}
	}

	return n_actions;
};

/**
 * main
 * 
 * This is where the entire shebang happens from start to finish
 * 
 * @return {null}
 */
const main = async function () {
	try {
		console.log('run');

		let last_action = await read_last(),
		    actions     = await fetch_actions();
		    actions     = filter_actions(actions);
		    actions     = strip_last(actions, last_action);
		
		post_actions(actions);

		if (actions.length > 0)
			save_last(actions[0].id, actions[0].timestamp);
	} catch (e) {}
};

/**
 * This anonymous function is actually needed in order to start an
 * async main function.
 * 
 * It also serially executes the main function every N seconds
 */
(async function () {
	main();
	setInterval(main, RUNTIME_DELAY);
}());