var MINUTE = 60 * 1000;
var HOUR = 60 * MINUTE;
var DAY = 24 * HOUR;
var WEEK = 7 * DAY;

var scout = ScoutingReport();

function getQueryParams(qs) {
	qs = qs.split('+').join(' ');
	var params = {},
		tokens,
		re = /[?&]?([^=]+)=([^&]*)/g;
	while (tokens = re.exec(qs)) {
		params[decodeURIComponent(tokens[1])] = decodeURIComponent(tokens[2]);
	}
	return params;
}

function updateScoutingReports(){
	scout.initializeReport('.scout-anchor');
}

function stopLoading(){
	var loading = document.getElementById('loading');
	var rosterPage = document.getElementById('roster-page');
	loading.style.display = 'none';
	rosterPage.style.display = 'block';
}

function InitLeagueRoster() {

	var app = InitApplication();
	var USER;
	if (app.checkUser()) {
		USER = app.getUser();
		app.displayUser();
	}
	var Database = app.getDatabase();

	var Constants = {
		logoutRedirect: 'index.html',
		loginRedirect: 'app.html',
		leagueRedirect: 'roster.html',
		finRedirect: 'fin.html',
		pending: 'Pending',
		pendingBench: 'Benching',
		pendingStart: 'Starting',
		pendingAcquire: 'Acquiring',
		pendingDrop: 'Dropping',
		userIdTag: 'userid',
		userEmailTag: 'email',
		userImageTag: 'image',
		userNameTag: 'name',
		userSelectedLeague: 'leagueid',
		seletedLeagueStart: 'leaguestart',
		seletedLeagueEnd: 'leagueend'
	};

	// Get information on an selected league
	var getLeagueData = () => {
		if (!USER['leagueid'])
			throw new Error("Leagueid not found.");
		return Database.getLeagueData({leagueid: USER['leagueid']}).then((leagueData) => {
			var gameEnd = false;
			var tmp = leagueData.users[Object.keys(leagueData.users)[0]];
			var idx = parseInt(tmp.losses) + parseInt(tmp.wins);
			if (leagueData.schedule.length === idx) {
				idx--;
				gameEnd = true;
			}
			var obj = leagueData.schedule[idx][0]

			USER['rosterdate'] = {
				prevfrom: obj.start - (obj.end - obj.start),
				prevto: obj.start,
				thisfrom: obj.start,
				thisto: obj.end,
				week: idx
			};
			if (gameEnd) {
				USER['rosterdate']['ended'] = true;
			}
		}).catch((err) => {
			log("Error thrown, " + err);
		});
	};

	var getLeague = (params) => {
		if(!params.userid)
			throw new Error('Must specify {userid}.');
		else if(!params.leagueid)
			throw new Error('Must specify {leagueid}.');
		else if(!params.from)
			throw new Error('Must specify {from}.');
		else if(!params.to)
			throw new Error('Must specify {to}.');

		return Database.getLeague(params).then(function(result) {
			log(result);
			return result; // this return is used by loadRosterPage()
		}, function(err) {
			log(err);
		});
	};

	// Gets the user's roster based on a selected league
	var getRoster = (params) => {
		if(!params.userid)
			throw new Error('Must specify {userid}.');
		else if(!params.leagueid)
			throw new Error('Must specify {leagueid}.');
		else if(!params.from)
			throw new Error('Must specify {from}.');
		else if(!params.to)
			throw new Error('Must specify {to}.');

		return Database.getRoster(params).then(function(rosterData) {
			test = rosterData;
			var playerList = Object.keys(rosterData.players).map(function(id) {
				return {
					playerid: id,
					name: rosterData.players[id].name,
					owner: rosterData.players[id].owner,
					starter: rosterData.players[id].starter,
					ward: rosterData.players[id].ward,
					scores: rosterData.players[id].scores,
					pending: ""
				};
			});
			USER['roster'] = {
				userid: rosterData.userid,
				leagueid: rosterData.leagueid,
				from: rosterData.from,
				to: rosterData.to,
				players: playerList
			};
			log(USER['roster']);

		}).catch((err) => {
			log("Error thrown, " + err);
		});
	};

	var getAllPlayers = (params) => {
		if(!params.leagueid)
			throw new Error('DB - leagueid not found.');
		else if(!params.from)
			throw new Error('DB - starting date not found');
		else if(!params.to)
			throw new Error('DB - ending date not found');

		return Database.getAllPlayers(params).then(function(result) {
			USER['allPlayers'] = [];
			log(result);
			Object.keys(result).sort().map(function(id) {
				USER['allPlayers'].push({
					name: result[id].name,
					owner: result[id].owner,
					playerid: result[id].playerid,
					scores: result[id].scores,
					starter: result[id].starter,
					ward: result[id].ward,
					show: true,
					pending: ""
				});
			});
			log(USER.allPlayers);

		}).catch((err) => {
			log("Thrown, " + err);
		});
	};



	var LeagueRoster = {

		// Displays the players the user currently have
		displayRoster: () => {
			log('showing loading screen');
			if(!USER.userid)
				throw new Error('userid not found.');
			else if(!USER.leagueid)
				throw new Error('leagueid not found.');
			else if(!USER.rosterdate.prevfrom)
				throw new Error('starting date not found');
			else if(!USER.rosterdate.prevto)
				throw new Error('ending date not found');

			getRoster({
				userid: USER.userid,
				leagueid: USER.leagueid,
				from: USER.rosterdate.prevfrom,
				to: USER.rosterdate.prevto
			}).then(() => {
				if (!USER['_roster-list']) {
					USER['_roster-list'] = Vue.component('roster-list', {
						props: ['row', 'header', 'range'],
						template: '<tr>\
							<td class="scout-anchor" :data-pid="row.playerid" :data-from="range.from" :data-to="range.to">{{ row.name }}</td>\
							<td>{{ row.scores[Object.keys(header)[0]] }}</td>\
							<td>{{ row.scores[Object.keys(header)[1]] }}</td>\
							<td>{{ row.scores[Object.keys(header)[2]] }}</td>\
							<td>{{ row.scores[Object.keys(header)[0]] + row.scores[Object.keys(header)[1]] + row.scores[Object.keys(header)[2]] }}</td>\
							<td>{{ (row.starter)? \'Starter\' : \'Benched\' }}</td>\
							<td><button v-on:click="$emit(\'toggle\')">Toggle</button></td>\
							<td>{{ row.pending }}</td>\
						</tr>'
					});
				}
				var week = USER['selectedleague'].users[Object.keys(USER['selectedleague'].users)[0]];
				//var workingRoster = jQuery.extend(true, {}, USER['roster']['players']);
				USER['_userRoster'] = new Vue({
					el: '#userRoster',
					data: {
						headers: Database.Scoring.DATASET_NAMES,
						leaguename: USER['selectedleague']['name'],
						objective: (USER['selectedleague'].schedule === (parseInt(week.losses) + parseInt(week.wins)))? "Game Ended, Redirecting..." : "Choose your lineup for week " + ((parseInt(week.losses) + parseInt(week.wins))+1).toString() + " of " + USER['selectedleague'].schedule.length.toString(),
						players: USER['roster']['players'],
						range: {
							from: USER.rosterdate.prevto - (4 * WEEK),
							to: USER.rosterdate.prevto
						},
						// update aggregator, reference scoring.js
						aggregator: Object.keys(USER['roster']['players']).map(function(id) {
							if (!USER['roster']['players'][id].starter){
								return 0;
							}
							var cols = Object.keys(Database.Scoring.DATASET_NAMES);
							return USER['roster']['players'][id].scores[cols[0]] + USER['roster']['players'][id].scores[cols[1]] + USER['roster']['players'][id].scores[cols[2]];
						}).reduce((a, b) => a + b, 0),
						toggle: {}
					},
					mounted: function(){
						updateScoutingReports();
					},
					methods: {
						updateAggregator: () => {
							USER['_userRoster'].aggregator = Object.keys(USER['_userRoster'].players).map(function(id) {
							if (!USER['roster']['players'][id].starter){
								return 0;
							}
							var cols = Object.keys(Database.Scoring.DATASET_NAMES);
							return USER['roster']['players'][id].scores[cols[0]] + USER['roster']['players'][id].scores[cols[1]] + USER['roster']['players'][id].scores[cols[2]];
							}).reduce((a, b) => a + b, 0);
						},
						togglePlayer: (idx) => {
							var tmp = USER['_userRoster'];

							if (USER['workingRoster']) {
								// makes sure the selected is not the same, if so undo select
								if (USER['workingRoster'].playerid == tmp.players[idx].playerid) {
									tmp.players[idx].pending = "";
									USER['workingRoster'] = null;
								}
								// if everything checks out with the player move, then update database
								else if (USER['workingRoster'].starter != tmp.players[idx].starter) {
									tmp.players[idx].pending = (tmp.players[idx].starter)? Constants.pendingBench : Constants.pendingStart;
									var p1 = USER['workingRoster'];
									var p2 = tmp.players[idx];
									var move = {
										userid: USER['userid'],
										leagueid: USER['leagueid'],
										sit: (p1.starter)? p1.playerid : p2.playerid,
										start: (!p1.starter)? p1.playerid : p2.playerid
									}
									// temporarily disable the toggle buttons
									if (Database.IN_SIMULATED_TIME) {
										move['timestamp'] = (USER.rosterdate.prevto - USER.rosterdate.prevfrom)/2 + USER.rosterdate.prevfrom;
									}
									Database.movePlayer(move).then(function(movePlayer) {
										if (movePlayer.success){
											p1.starter = p2.starter;
											p2.starter = !p2.starter;
											p1.pending = p2.pending = "";
											USER['roster']['players'] = tmp.players; // temporary fix
											USER['workingRoster'] = null;
										}
									}).catch(function(err) {
										log(err);
									});
								}
								// otherwise, revert and show error in user's movement
								else {
									log("Invalid player movement!");
									tmp.players[idx].pending = USER['workingRoster'].pending = "";
									USER['workingRoster'] = null;
								}
							}
							// adds pending update to the UI
							else {
								tmp.players[idx].pending = (tmp.players[idx].starter)? Constants.pendingBench : Constants.pendingStart;
								USER['workingRoster'] = tmp.players[idx];
							}
						}
					}
				});
			});
		},

		// Displays all the players in the game
		displayAllPlayers: () => {
			if(!USER.leagueid)
				throw new Error('UI - leagueid not found.');
			else if(!USER.rosterdate.prevfrom)
				throw new Error('UI - starting date not found');
			else if(!USER.rosterdate.prevto)
				throw new Error('UI - ending date not found');

			getAllPlayers({
				leagueid: USER.leagueid,
				from: USER.rosterdate.prevfrom,
				to: USER.rosterdate.prevto
			}).then(() => {

				if (!USER['_player-list']) {
					USER['_player-list'] = Vue.component('player-list', {
						props: ['row', 'header', 'range'],
						template: '<tr v-show=\'row.show\'>\
							<td>{{ row.ward }}</td>\
							<td class="scout-anchor" :data-pid="row.playerid" :data-from="range.from" :data-to="range.to">{{ row.name }} </td>\
							<td>{{ row.scores[Object.keys(header)[0]] }}</td>\
							<td>{{ row.scores[Object.keys(header)[1]] }}</td>\
							<td>{{ row.scores[Object.keys(header)[2]] }}</td>\
							<td>{{ row.scores[Object.keys(header)[0]] + row.scores[Object.keys(header)[1]] + row.scores[Object.keys(header)[2]] }}</td>\
							<td>{{ (!row.owner)? \'None\' : checkName(row.owner) }}</td>\
							<td><button v-on:click="$emit(\'acquire\')" :disabled="(!row.owner || checkUser(row))? false : true">{{ (checkUser(row)) ? \'Drop\' : \'Acquire\' }}</button></td>\
							<td>{{ row.pending }}</td>\
						</tr>',
						methods: {
							checkUser: (other) => {
								return (other.owner == USER['userid']);
							},
							checkName: (owner) => {
								if (USER['selectedleague']) {
									return USER['selectedleague'].users[owner].name;
								}
								return owner;
							}
						}
					});
				}
				// Save point
				// In order for sorting to work, the _player-list template needs to enclose the whole table element
				var workingPlayers = jQuery.extend(true, {}, USER['allPlayers']);

				USER['_allPlayers'] = new Vue({
					el: '#allPlayers',
					data: {
						headers: Database.Scoring.DATASET_NAMES,
						players: workingPlayers,
						range: {
							from: USER.rosterdate.prevto - (4 * WEEK),
							to: USER.rosterdate.prevto
						},
						//rosters: userRosters,
						//players: USER['allPlayers'],
						order: 0,
						reverse: 1
					},
					mounted: function(){
						updateScoutingReports();
						//setTimeout(function(){
							stopLoading();
						//}, 1500);
					},
					methods: {
						ordering: (orderBy) => {
							var rendering = {};
							for (var i = 0; i < Object.keys(USER['_allPlayers'].players).length; i++) {
								rendering[USER['_allPlayers'].players[i].playerid] = USER['_allPlayers'].players[i].show;
							}
							log(rendering);
							USER['_allPlayers'].reverse *= -1;
							USER['_allPlayers'].order = orderBy;
							var header = Object.keys(Database.Scoring.DATASET_NAMES);
							var comparator = [	(a, b) => {return (a.ward > b.ward)? 1 : ((b.ward > a.ward)? -1 : 0);},
												(a, b) => {return (a.name > b.name)? 1 : ((b.name > a.name)? -1 : ((a.ward > b.ward)? 1*(USER['_allPlayers'].reverse) : -1*(USER['_allPlayers'].reverse)));},
												(a, b) => {return (a.scores[header[0]] > b.scores[header[0]])? 1 : ((b.scores[header[0]] > a.scores[header[0]])? -1 : ((a.ward > b.ward)? 1*(USER['_allPlayers'].reverse) : -1*(USER['_allPlayers'].reverse)));},
												(a, b) => {return (a.scores[header[1]] > b.scores[header[1]])? 1 : ((b.scores[header[1]] > a.scores[header[1]])? -1 : ((a.ward > b.ward)? 1*(USER['_allPlayers'].reverse) : -1*(USER['_allPlayers'].reverse)));},
												(a, b) => {return (a.scores[header[2]] > b.scores[header[2]])? 1 : ((b.scores[header[2]] > a.scores[header[2]])? -1 : ((a.ward > b.ward)? 1*(USER['_allPlayers'].reverse) : -1*(USER['_allPlayers'].reverse)));},
												(a, b) => {return ( (a.scores[header[0]] + a.scores[header[1]] + a.scores[header[2]]) > (b.scores[header[0]] + b.scores[header[1]] + b.scores[header[2]]) )? 1 : (( (b.scores[header[0]] + b.scores[header[1]] + b.scores[header[2]]) > (a.scores[header[0]] + a.scores[header[1]] + a.scores[header[2]]) )? -1 : ((a.ward > b.ward)? 1*(USER['_allPlayers'].reverse) : -1*(USER['_allPlayers'].reverse)));},
												(a, b) => {return (b.owner == false || a.owner > b.owner)? 1 : ((a.owner == false || b.owner > a.owner)? -1 : ((a.ward > b.ward)? 1*(USER['_allPlayers'].reverse) : -1*(USER['_allPlayers'].reverse)));},
												(a, b) => {return (a.ward > b.ward)? 1 : ((b.ward > a.ward)? -1 : 0);}	];

							var sorted = USER.allPlayers.sort(comparator[orderBy]);
							if (USER['_allPlayers'].reverse == -1)
								sorted.reverse();

							for (var i = 0; i < Object.keys(USER['_allPlayers'].players).length; i++) {
								USER._allPlayers.players[i] = Object.assign({}, USER._allPlayers.players[i], {
									ward: sorted[i].ward,
									name: sorted[i].name,
									owner: sorted[i].owner,
									playerid: sorted[i].playerid,
									starter: sorted[i].starter,
									scores: sorted[i].scores,
									show: rendering[sorted[i].playerid],
									pending: (USER['workingPlayers'] && USER['workingPlayers'].playerid == sorted[i].playerid)? USER['workingPlayers'].pending : sorted[i].pending
								});
							}
							updateScoutingReports();
						},
						acquirePlayer: (idx) => {
							var tmp = USER['_allPlayers']; // used to refer to the list of all players
							if (USER['workingPlayers']) {
								// makes sure the selected is not the same, if so undo the selected
								if (USER['workingPlayers'].playerid == tmp.players[idx].playerid) {
									tmp.players[idx].pending = "";
									USER['workingPlayers'] = null;
									for (var i = 0; i < Object.keys(USER['_allPlayers'].players).length; i++) {
										tmp.players[i].show = true;
									}
								}
								else if (USER['workingPlayers'].owner ==  USER['userid'] && tmp.players[idx].owner == false ||
										 USER['workingPlayers'].owner ==  false && tmp.players[idx].owner == USER['userid']) {
									tmp.players[idx].pending = (tmp.players[idx].owner)? Constants.pendingDrop : Constants.pendingAcquire;
									var p1 = USER['workingPlayers'];
									var p2 = tmp.players[idx];
									var move = {
										userid: USER['userid'],
										leagueid: USER['leagueid'],
										add: (!p1.owner)? p1.playerid : p2.playerid,
										drop: (p1.owner)? p1.playerid : p2.playerid
									}
									if (Database.IN_SIMULATED_TIME) {
										move['timestamp'] = (USER.rosterdate.prevto - USER.rosterdate.prevfrom)/2 + USER.rosterdate.prevfrom;
									}
									Database.acquirePlayer(move).then(function(acquirePlayer) {
										if (acquirePlayer.success) {
											p1.pending = p2.pending = "";
											if (p1.owner == false) {
												p1.owner = p2.owner;
												p2.owner = false;
												if (USER['_userRoster']) {
													USER['_userRoster'].players.filter(function(item) {
														if (item.playerid == p2.playerid) {
															item.name = p1.name;
															item.playerid = p1.playerid;
															item.scores = p1.scores;
															item.ward = p1.ward;
														}
													});
													USER['_userRoster'].updateAggregator();
												}
											} else {
												p2.owner = p1.owner;
												p1.owner = false;
												if (USER['_userRoster']) {
													USER['_userRoster'].players.filter(function(item) {
														if (item.playerid == p1.playerid) {
															item.name = p2.name;
															item.playerid = p2.playerid;
															item.scores = p2.scores;
															item.ward = p2.ward;
														}
													});
													USER['_userRoster'].updateAggregator();
												}
											}
											USER['workingPlayers'] = null;
											for (var i = 0; i < Object.keys(USER['_allPlayers'].players).length; i++) {
												tmp.players[i].show = true;
											}
										}
									}).catch((err) => {
										log(err);
										// this error should never be executed because the filtering of player list when selecting prevents this
										vex.dialog.alert("Unable to complete action, player taken");
										USER['workingPlayers'] = tmp.players[idx].pending = "";
										USER['workingPlayers'] = null;
										getAllPlayers({
											leagueid: USER.leagueid,
											from: USER.rosterdate.prevfrom,
											to: USER.rosterdate.prevto
										}).then(() => {
											log("Updates after an error");
											if (USER['_allPlayers']) {
												// reset player orderings
												USER['_allPlayers'].reverse = -1; // calling ordering will flip -1 to 1 b4 applying update
												USER['_allPlayers'].ordering(0);
												// reset player list
												for (var i = 0; i < Object.keys(USER['_allPlayers'].players).length; i++) {
													USER['_allPlayers'].players[i] = Object.assign({}, USER._allPlayers.players[i], USER.allPlayers[i]);
													USER['_allPlayers'].players[i]['show'] = true;
												}
											}
										}).catch((err) => {
											log(err);
										});
									});
								}
								else {
									log("Invalid Add/Drop of players");
								}
							}
							// selecting the first player to add or drop
							else {
								log(idx);
								USER['workingPlayers'] = tmp.players[idx];
								tmp.players[idx].pending = (tmp.players[idx].owner)? Constants.pendingDrop : Constants.pendingAcquire;

								for (var i = 0; i < Object.keys(USER['_allPlayers'].players).length; i++) {
									if (tmp.players[i].owner === false) {
										tmp.players[i].show = (tmp.players[idx].owner)? true : false;
									}
									else {
										tmp.players[i].show = (tmp.players[idx].owner)? false : true;
									}
								}
								USER['workingPlayers'].show = true;
							}
						}
					}
				});
			});

			Database.when('rosters_change', {
				leagueid: USER['leagueid']
			}, (change) => {
				if (change.changed) {
					getAllPlayers({
						leagueid: USER.leagueid,
						from: USER.rosterdate.prevfrom,
						to: USER.rosterdate.prevto
					}).then(() => {
						log("Player List updated");
						if (USER['_allPlayers']) {
							// save current user's player orderings
							var currentOrder = USER['_allPlayers'].order;
							var currentReverse = USER['_allPlayers'].reverse * -1;
							// revert ordering to ward ascending order
							USER['_allPlayers'].reverse = -1; // calling ordering will flip -1 to 1 b4 applying update
							USER['_allPlayers'].ordering(0);
							// apply updates to the player's list
							for (var i = 0; i < Object.keys(USER['_allPlayers'].players).length; i++) {
								if (USER.allPlayers[i].owner != USER['_allPlayers'].players[i].owner)
									USER._allPlayers.players[i] = Object.assign({}, USER._allPlayers.players[i], {
										owner: USER.allPlayers[i].owner
									});
								// 	Vue.set(USER['_allPlayers'].players[i], 'owner', USER.allPlayers[i].owner);
							}
							var reset = false;
							if (USER['workingPlayers']) { // if user is selecting when the update happens
								for (var i = 0; i < Object.keys(USER['_allPlayers'].players).length; i++) {
									if (USER['_allPlayers'].players[i].ward === USER['workingPlayers'].ward) {
										if (USER['workingPlayers'].owner === false && USER['_allPlayers'].players[i].owner !== false) {
											// acquire then drop case, if user1 selects player1 to acquire, but user2 drops and select player1 before user1 finishes
											reset = true; 
											break;
										}
									}
									if (USER['_allPlayers'].players[i].owner === false || USER['_allPlayers'].players[i].playerid === USER['workingPlayers'].playerid) {
										USER['_allPlayers'].players[i].show = (USER['workingPlayers'].owner)? true : false;
									}
									else {
										USER['_allPlayers'].players[i].show = (USER['workingPlayers'].owner)? false : true;
									}
								}
							}
							if (reset) {
								vex.dialog.alert("Sorry, another user took that player already!");
								USER['workingPlayers'] = null;
								for (var i = 0; i < Object.keys(USER['_allPlayers'].players).length; i++) {
									USER['_allPlayers'].players[i].show = true;
								}
								USER['_allPlayers'].reverse = -1; // calling ordering will flip -1 to 1 b4 applying update
								USER['_allPlayers'].ordering(0);
							}
							else {
								// revert the ordering to the user's setting
								USER['_allPlayers'].reverse = currentReverse;
								USER['_allPlayers'].ordering(currentOrder);
							}

						}
					}).catch((err) => {
						log(err);
					});
				}
			});
		},
		
		// Executes when user clicks the finalize button on the roster page
		setMatchOutcome: () => {
			if (!USER['userid'])
				throw new Error("UI - userid not found.");
			if (!USER['leagueid'])
				throw new Error("UI - leagueid not found.");
			if (!USER['rosterdate']['prevfrom'] || !USER['rosterdate']['prevto'])
				throw new Error("UI - date range not found.")
			log((USER.rosterdate.thisto - USER.rosterdate.thisfrom)/2 + USER.rosterdate.thisfrom);
			Database.setMatchOutcome({
				userid: USER['userid'],
				leagueid: USER['leagueid'],
				on: (USER.rosterdate.thisto - USER.rosterdate.thisfrom)/2 + USER.rosterdate.thisfrom
			}).then((matchOutcome) => {
				if (matchOutcome.success) {
					log("Success");
					LeagueRoster.viewOutcome();
				}
			}).catch((err) => {
				console.error(err)
			});
		},

		viewOutcome: () => {
			var leagueid = USER.leagueid;
			var sim = USER.rosterdate;
			var timestamp = sim.thisfrom + (0.5 * (sim.thisto - sim.thisfrom));
			var uParts = document.location.pathname.split('/');
			var pathname = uParts.slice(0, uParts.length - 1).join('/');
			var url = document.location.origin + pathname + '/live.html' + '?time=' + timestamp + '&league=' + leagueid;
			document.location = url;
		},

		openScoutingModule: () => {
			var leagueid = USER.leagueid;
			var sim = USER.rosterdate;
			var timestamp = sim.thisfrom + (0.5 * (sim.thisto - sim.thisfrom));
			var uParts = document.location.pathname.split('/');
			var pathname = uParts.slice(0, uParts.length - 1).join('/');
			var url = document.location.origin + pathname + '/scout.html' + '?time=' + timestamp + '&league=' + leagueid;
			window.open(url, '_blank');
		},

		userLogout: () => {
			app.userLogout();
		},

		// this function is specific to the items needed at the roster page
		loadRosterPage: () => {
			var loadRosterPageCallBack = () => {
				console.log(USER)
				getLeagueData({
					leagueid: USER['leagueid']
				}).then(() => {
					getLeague({
						userid: USER.userid,
						leagueid: USER.leagueid,
						from: USER.rosterdate.prevfrom,
						to: USER.rosterdate.prevto
					}).then((userSelect) => {
						log(userSelect);
						USER['selectedleague'] = userSelect;
						log(USER);
						LeagueRoster.displayRoster();
						LeagueRoster.displayAllPlayers();
						// This function is called when roster is being loaded, so only redirect if we are loading from roster
						if (USER.rosterdate.ended) {
							window.location.href = Constants.finRedirect;
						}
					})
				}).catch((err) => {
					log("Thrown, " + err);
				});
			}
			loadRosterPageCallBack();
		}

	}; // end of factory function return

	return LeagueRoster;
}