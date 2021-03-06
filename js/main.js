/* global SpotifyWebApi, dndTree, $, geoplugin_countryCode, Promise, google, setRepeatArtists */
(function () {
	'use strict';

	var audio = null;
	var currentPlayingSongId = null;
	var playMusic = true;
	var numberOfArtistsToShow = 10;

	var api = new SpotifyWebApi();

	var showCompletion = true;
	var volume = 0.5;

	var repeatArtists = false;

	var userCountry;

	window.onresize = function () {
		dndTree.resizeOverlay();
		var height = $(window).height();
		$('#rightpane').height(height);
	};

	$('#rightpane').height($(window).height());

	function setRepeatArtists() {
		if (document.getElementById('repeatArtists').checked) {
			repeatArtists = true;
		} else {
			repeatArtists = false;
		}
	}

	function initContainer() {
		var initArtistId = stripTrailingSlash(qs('artist_id')),
			initGenre = stripTrailingSlash(qs('genre'));

		if (initArtistId) {
			api.getArtist(initArtistId).then(initRootWithArtist);
		} else if (initGenre) {
			initRootWithGenre(initGenre);
		} else {
			api.getArtist('43ZHCT0cAZBISjO8DG9PnE').then(initRootWithArtist);
		}
	}

	window.addEventListener('load', function () {
		userCountry = geoplugin_countryCode();
		initContainer();

		var formArtist = document.getElementById('search-artist');
		formArtist.addEventListener('submit', function (e) {
			showCompletion = false;
			e.preventDefault();
			var search = document.getElementById('artist-search');
			api.searchArtists(
				search.value.trim(),
				{ market: userCountry }
				).then(function (data) {
				if (data.artists && data.artists.items.length) {
					initRootWithArtist(data.artists.items[0]);
				}
			});

		}, false);


		var formGenre = document.getElementById('search-genre');
		formGenre.addEventListener('submit', function (e) {
			showCompletion = false;
			e.preventDefault();
			var search = document.getElementById('genre-search');
			console.log('setting root genre');
			var genreName = search.value.trim();
			initRootWithGenre(genreName);
		}, false);

	}, false);

	function qs(name) {
		name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
		var regex = new RegExp('[\\?&]' + name + '=([^&#]*)'),
			results = regex.exec(location.search);
		return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
	}

	function stripTrailingSlash(str) {
		if (str.substr(-1) == '/') {
			return str.substr(0, str.length - 1);
		}
		return str;
	}

	var allGenres = [];

	loadAllGenres();

	function initRootWithArtist(artist) {
		dndTree.setRoot(artist);
		$('#genre-search').val('');
	}

	function initRootWithGenre(genre) {
		dndTree.setRootGenre(genre);
		$('#artist-search').val('');
	}

	function loadAllGenres() {
		$.ajax({
			url: 'https://developer.echonest.com/api/v4/genre/list?api_key=WKWPYLFXFLROAQB2B&format=json&results=1500'
		}).done(function (data) {
			data.response.genres.forEach(function (genre) {
				allGenres.push(toTitleCase(genre.name));
			});
		});
	}

	function toTitleCase(str) {
		return str.replace(/\w\S*/g, function (txt) {return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
	}

	var getInfoTimeoutid;
	function getInfo(artist) {
		getInfoTimeoutid = window.setTimeout(function () {
			_getInfo(artist);
			$('#rightpane').animate({ scrollTop: '0px' });
		}, 500);
	}

	function getInfoCancel(artist) {
		window.clearTimeout(getInfoTimeoutid);
	}

	function setBioVisibility(val) {
		if (val) {
			$('#biography').show();
			$('#biography-label').show();
		} else {
			$('#biography').hide();
			$('#biography-label').hide();
		}
	}

	function setGenresVisibility(val) {
		if (val) {
			$('#mainGenres').show();
			$('#main-genres-label').show();
		} else {
			$('#mainGenres').hide();
			$('#main-genres-label').hide();
		}
	}

	function _getInfo(artist) {

		$('#infobox').css('visibility', 'visible');
		$('#hoverwarning').css('display', 'none');

		$('#artistName').text(artist.name);
		$('#artistName').attr('href', artist.external_urls.spotify);
		$('#artistName').attr('target', '_blank');

		drawChart(artist.popularity);
		$.ajax({
			url: 'https://developer.echonest.com/api/v4/artist/profile?api_key=WKWPYLFXFLROAQB2B&id=' +
			artist.uri +
			'&bucket=genre&bucket=biographies&format=json'
		}).done(function (data) {
			var found = false;
			data.response.artist.biographies.forEach(function (biography) {
				if (!biography.truncated && !found) {
					$('#biography').text(biography.text);
					found = true;
					setBioVisibility(true);
				}
			});

			if (found === false) {
				setBioVisibility(false);
			}

			$('#mainGenres').empty();
			if (!data.response.artist.genres || data.response.artist.genres.length === 0) {
				setGenresVisibility(false);
			} else {
				setGenresVisibility(true);
			}
			data.response.artist.genres.forEach(function (genre) {
				$('#mainGenres').append('<li><a>' + toTitleCase(genre.name) + '</a></li>');
			});
			$('#mainGenres li').click(function () {
				initRootWithGenre($(this).text());
			});
		});

		api.getArtistTopTracks(artist.id, userCountry).then(function (data) {
			$('#divPopularTracks')
				.removeClass('alert')
				.text('');
			playForTrack(data.tracks[0]);
			$('#popularTracks').empty();
			data.tracks.forEach(function (track, i) {
				var className = 'now-playing';
				if (i === 0 && playMusic) {
					className += ' active';
				}

				$('#popularTracks')
					.append('<li class="' + className + '" onmouseover="AE.playFromList(this)" onmouseout="AE.playFromListCancel()" data-track-id=' +
						track.id + ' data-preview-url=' + track.preview_url + '>' +
						'<a target="_blank" href="' + track.external_urls.spotify + '">' + track.name + '</a>' +
						'</li>');
			});
		}, function (err) {
			$('#divPopularTracks')
				.addClass('alert')
				.text('Oops, seems like there are no available tracks in your country');
			$('#popularTracks').empty();
			clearMusic();
		});
	}

	function getRelated(artistId, excludeList) {
		return new Promise(function (resolve, reject) {
			return api.getArtistRelatedArtists(artistId).then(function (data) {

				data.artists.sort(function (a, b) {
					return b.popularity - a.popularity;
				});
				if (!repeatArtists) {
					data.artists = data.artists.filter(function (artist) {
						return excludeList.indexOf(artist.id) === -1;
					});
				}

				resolve(data.artists.slice(0, numberOfArtistsToShow));
			});
		});
	}


	function getIdFromArtistUri(artistUri) {
		return artistUri.split(':').pop();
	}

	function getArtistsForGenre(genreName) {
		return new Promise(function (resolve, reject) {
			return $.ajax({
				url: 'https://developer.echonest.com/api/v4/genre/artists?api_key=WKWPYLFXFLROAQB2B' +
				'&format=json&results=15&bucket=id:spotify&limit=true' +
				'&name=' + encodeURIComponent(genreName.toLowerCase())
			}).then(function (data) {
				var idsToRequest = [];
				data.response.artists.forEach(function (artist) {
					if (artist.foreign_ids) {
						idsToRequest.push(getIdFromArtistUri(artist.foreign_ids[0].foreign_id));
					}
				});
				return api.getArtists(idsToRequest).then(function (data) {
					//Sort in popularity order
					resolve(data.artists.sort(function (a, b) {
						return b.popularity - a.popularity;
					}).slice(0, numberOfArtistsToShow));
				});
			});
		});
	}


	function changeNumberOfArtists(value) {
		numberOfArtistsToShow = value;
		document.getElementById('range-indicator').innerHTML = value;
	}

	function createAutoCompleteDiv(artist) {
		if (!artist) {
			return;
		}
		var val = '<div class="autocomplete-item">' +
			'<div class="artist-icon-container">' +
			'<img src="' + getSuitableImage(artist.images) + '" class="circular artist-icon" />' +
			'<div class="artist-label">' + artist.name + '</div>' +
			'</div>' +
			'</div>';
		return val;
	}

	var unavailCountryMessageSet = false;

	function setUnavailCountryErrorMessage() {
		var msg = 'Oops, seems like Spotify is not available in your country yet';
		if (unavailCountryMessageSet) {
			return;
		}
		var message = '<div class="alert alert-danger alert-error">' +
			msg +
			'</div>';
		$('#rightpane').prepend(message);
		unavailCountryMessageSet = true;
	}

	$(function () {
		$('#artist-search')
			// don't navigate away from the field on tab when selecting an item
			.bind('keydown', function (event) {
				showCompletion = true;
				if (event.keyCode === $.ui.keyCode.TAB &&
					$(this).autocomplete('instance').menu.active) {
					event.preventDefault();
				}
			})
			.autocomplete({
				minLength: 0,
				source: function (request, response) {
					api.searchArtists(request.term + '*', {'limit': 50, market: userCountry}).then(function (data) {
						if (data.artists && data.artists.items.length) {
							var res = [];
							data.artists.items.forEach(function (artist) {
								res.push(artist);
							});
							if (showCompletion) {
								response(res);
							} else {
								response([]);
							}
						}
					}, function (err) {
						if (err.status == 400) {
							setUnavailCountryErrorMessage();
							return;
						}
					});
				},
				focus: function () {
					// prevent value inserted on focus
					return false;
				},
				select: function (event, ui) {
					$('#artist-search').val(ui.item.name);
					initRootWithArtist(ui.item);
					return false;
				}
			})
			.autocomplete('instance')._renderItem = function (ul, item) {
				if (!item) {
					console.log('no item');
					return;
				}
				return $('<li></li>')
					.data('item.autocomplete', item)
					.append(createAutoCompleteDiv(item))
					.appendTo(ul);
			};

		$('#genre-search')
			// don't navigate away from the field on tab when selecting an item
			.bind('keydown', function (event) {
				showCompletion = true;
				if (event.keyCode === $.ui.keyCode.TAB &&
					$(this).autocomplete('instance').menu.active) {
					event.preventDefault();
				}
				if (event.keyCode == 13) {
					$('.ui-menu-item').hide();
				}
			})
			.autocomplete({
				minLength: 0,
				source: function (request, response) {
					if (showCompletion) {
						response($.ui.autocomplete.filter(allGenres, request.term));
					} else {
						response([]);
					}
				},
				focus: function (e, ui) {
					// prevent value inserted on focus
					return false;
				},
				select: function (event, ui) {
					$('#genre-search').val(ui.item.value);
					initRootWithGenre(ui.item.value);
					return false;
				}
			});
	});

	function setDefaultPopularTracks() {
		$('#popularTracks li').removeClass('active');
	}

	var playPopTrackTimeoutId;

	function playFromList(obj) {
		playPopTrackTimeoutId = window.setTimeout(function () {
			_playFromList(obj);
		}, 500);
	}

	function playFromListCancel() {
		window.clearTimeout(playPopTrackTimeoutId);
	}

	function _playFromList(obj) {
		setDefaultPopularTracks();
		if (!playMusic) {
			return;
		}
		$(obj).addClass('now-playing active');

		var trackId = obj.getAttribute('data-track-id');
		var previewUrl = obj.getAttribute('data-preview-url');
		var trac = {
			'id': trackId,
			'preview_url': previewUrl
		};
		playForTrack(trac);
	}

	//No need for this after setting volume
	function playMusicHandler() {
		if (document.getElementById('playMusic').checked) {
			playMusic = true;
		} else {
			playMusic = false;
			clearMusic();
		}
	}

	function setVolume(vol) {
		volume = vol;
		audio.volume = vol;
	}

	function playForTrack(track_to_play) {
		if (!playMusic) {
			return;
		}

		if (currentPlayingSongId == track_to_play.id) {
			return;
		}
		if (currentPlayingSongId != null) {
			audio.setAttribute('src', track_to_play.preview_url);
			audio.load();
			audio.play();
		} else {
			audio = new Audio(track_to_play.preview_url);
			audio.volume = volume;
			audio.load();
			audio.play();
		}
		currentPlayingSongId = track_to_play.id;
	}

	function clearMusic() {
		setDefaultPopularTracks();
		if (audio) {
			audio.pause();
		}
		currentPlayingSongId = null;
	}

	function drawChart(popularity) {
		var popData = google.visualization.arrayToDataTable([
			 ['Popularity', popularity],
		], true);

		var options = {
			width: 300, height: 120,
			redFrom: 80, redTo: 100,
			yellowFrom:50, yellowTo: 80,
			minorTicks: 5
		};

		var chart = new google.visualization.Gauge(document.getElementById('chart_div'));
		chart.draw(popData, options);
	}

	function getSuitableImage(images) {
		var minSize = 64;
		if (images.length === 0) {
			return 'img/spotify.jpeg';
		}
		images.forEach(function (image) {
			if (image && image.width > minSize && image.width > 64) {
				return image.url;
			}
		});

		return images[images.length - 1].url;
	}

	window.AE = {
		getSuitableImage: getSuitableImage,
		getRelated: getRelated,
		getArtistsForGenre: getArtistsForGenre,
		getInfoCancel: getInfoCancel,
		getInfo: getInfo,
		setVolume: setVolume,
		changeNumberOfArtists: changeNumberOfArtists,
		setRepeatArtists: setRepeatArtists,
		playFromList: playFromList,
		playFromListCancel: playFromListCancel,
		toTitleCase: toTitleCase
	};
})();